import os
import re
import json
import subprocess
from pathlib import Path
from typing import TypedDict, List, Dict, Optional, Any
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_ollama import ChatOllama

# 1. Anchor Paths to Project Root (/run/media/tanav/Shared/Alloy_Opt)
PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
load_dotenv(PROJECT_ROOT / ".env")

OLLAMA_MODEL = os.getenv("qwen3-coder:30B")
qwen_coder = ChatOllama(
    model="qwen3-coder:30B",
    temperature=0.1,
    num_ctx=16384,  # Expanded context window to hold types + sibling imports + compiler errors
)

gemini_fixer = ChatGoogleGenerativeAI(
    model="gemini-3.8-flash",
    temperature=0.2,
)

# 2. Define Graph State
class GraphState(TypedDict):
    generated_files: Dict[str, str]
    file_errors: Dict[str, List[str]]
    build_errors: List[str]
    iteration_count: int

def extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in content
        )
    return str(content)

def strip_code_fences(raw_code: str) -> str:
    fence_match = re.search(
        r"```(?:tsx|ts|typescript|javascript|jsx)?\s*\n(.*?)```",
        raw_code,
        re.DOTALL,
    )
    if fence_match:
        return fence_match.group(1).strip()
    return raw_code.strip("`").strip()

# Topological priority so leaf components are fixed BEFORE parent tabs/pages import them
def repair_sort_key(file_path: str) -> int:
    if "types/" in file_path:
        return 0
    if "lib/" in file_path:
        return 1
    if file_path.endswith(("Tab.tsx", "Page.tsx")):
        return 3
    if "app/page.tsx" in file_path:
        return 4
    return 2  # Leaf components (CandidateRankingTable, LabInputForm, PolymorphSelector, CrystalViewer3D, etc.)

# 3. Define Graph Nodes
def loader_node(state: GraphState):
    print("-> Loader: Loading existing frontend/src files from disk into GraphState...")
    src_dir = FRONTEND_DIR / "src"
    loaded_files: Dict[str, str] = {}

    for path in sorted(src_dir.rglob("*")):
        if path.is_file() and path.suffix in {".ts", ".tsx"}:
            rel_path = path.relative_to(FRONTEND_DIR).as_posix()
            loaded_files[rel_path] = path.read_text(encoding="utf-8")

    print(f"   [+] Loaded {len(loaded_files)} TypeScript files from {src_dir.relative_to(PROJECT_ROOT)}.")
    return {
        "generated_files": loaded_files,
        "iteration_count": state.get("iteration_count", 0),
    }

def compiler_node(state: GraphState):
    iteration = state.get("iteration_count", 0)
    print(f"\n-> Compiler (Pass {iteration}): Running `npx tsc --noEmit --pretty false`...")

    result = subprocess.run(
        ["npx", "tsc", "--noEmit", "--pretty", "false"],
        cwd=FRONTEND_DIR,
        capture_output=True,
        text=True,
    )

    if result.returncode == 0:
        print("   [+] Zero TypeScript errors! Build validated.")
        return {"build_errors": [], "file_errors": {}}

    raw_output = (result.stdout + "\n" + result.stderr).strip()
    lines = [line.strip() for line in raw_output.splitlines() if line.strip()]

    # Group errors by file path: e.g. "src/app/page.tsx(4,10): error TS2305: ..."
    file_errors: Dict[str, List[str]] = {}
    for line in lines:
        match = re.match(r"^(src/[^(]+)\(\d+,\d+\):\s*error\s+TS\d+:.*", line)
        if match:
            f_path = match.group(1).strip()
            file_errors.setdefault(f_path, []).append(line)

    total_errors = sum(len(v) for v in file_errors.values())
    print(f"   [!] Found {total_errors} error(s) across {len(file_errors)} file(s):")
    for f_path, errs in sorted(file_errors.items(), key=lambda x: repair_sort_key(x[0])):
        print(f"       - {f_path}: {len(errs)} error(s)")

    return {
        "build_errors": lines,
        "file_errors": file_errors,
    }

def developer_node(state: GraphState):
    iteration = state.get("iteration_count", 0) + 1
    file_errors = state.get("file_errors", {})
    generated_files = dict(state.get("generated_files", {}))

    broken_files = sorted(file_errors.keys(), key=repair_sort_key)
    active_llm = gemini_fixer if iteration >= 1 else qwen_coder
    active_model_name = "gemini-3.8-flash (Escalated)" if iteration >= 1 else "qwen3-coder:30B"
    print(f"\n-> Developer ({"qwen3-coder:30B"} | Healing Pass {iteration}): Repairing {len(broken_files)} file(s) in topological order...")

    for file_path in broken_files:
        errors_for_file = file_errors[file_path]
        current_code = generated_files.get(file_path, "")

        # Always provide the ground-truth contracts
        types_code = generated_files.get("src/types/materials.ts", "")
        api_code = generated_files.get("src/lib/api.ts", "")

        # Find any local sibling components imported or referenced
        related_context = []
        for other_path, other_code in generated_files.items():
            if other_path in {file_path, "src/types/materials.ts", "src/lib/api.ts", "src/app/layout.tsx"}:
                continue
            stem = Path(other_path).stem
            if stem in current_code or any(stem in err for err in errors_for_file):
                related_context.append(f"// --- {other_path} ---\n{other_code}")

        related_blob = "\n\n".join(related_context)

        print(f"   [*] Fixing {file_path} ({len(errors_for_file)} errors)...")
        prompt = f"""You are a staff TypeScript and Next.js (App Router) compiler engineer.
Fix ALL TypeScript compilation errors in `{file_path}` while keeping its complete scientific UI functionality and dark-mode Tailwind styling intact.

=== GROUND-TRUTH TYPES (`src/types/materials.ts`) ===
{types_code}

=== GROUND-TRUTH API CLIENT (`src/lib/api.ts`) ===
{api_code}

=== REFERENCED SIBLING COMPONENTS (Match their exact export style & Props interfaces!) ===
{related_blob if related_blob else "// None"}

=== CURRENT BROKEN CODE FOR `{file_path}` ===
{current_code}

=== EXACT TYPESCRIPT COMPILER ERRORS IN `{file_path}` ===
{chr(10).join(errors_for_file)}

STRICT RULES:
1. Return ONLY the complete, valid TypeScript/TSX source code for `{file_path}`. Do NOT include markdown commentary or explanations.
2. Add `"use client";` on line 1 if the component uses React hooks or event handlers.
3. Match the exact property names and types defined in `src/types/materials.ts` and `src/lib/api.ts`.
4. Match the exact default vs. named export conventions of any imported sibling components.
5. Explicitly type all callback parameters (never leave implicit `any` parameters).
6. For `CrystalViewer3D.tsx`, if `@react-three/fiber` JSX intrinsic elements (`<mesh>`, `<sphereGeometry>`, `<ambientLight>`, etc.) trigger React 19 `JSX.IntrinsicElements` errors, either use standard Three.js imperatively with a `useRef<HTMLDivElement>` + `THREE.WebGLRenderer`, or declare the intrinsic elements cleanly so `tsc --noEmit` passes with zero errors.
"""

        response = active_llm.invoke(prompt)
        fixed_code = strip_code_fences(extract_text(response.content))

        if fixed_code:
            # Update in-memory state immediately so parent tabs repaired later in this loop see the fixed child component!
            generated_files[file_path] = fixed_code

    return {
        "generated_files": generated_files,
        "iteration_count": iteration,
    }

def writer_node(state: GraphState):
    print("-> Writer: Writing updated files to disk...")
    file_errors = state.get("file_errors", {})
    generated_files = state.get("generated_files", {})

    for file_path in file_errors.keys():
        code = generated_files.get(file_path)
        if code:
            full_path = FRONTEND_DIR / file_path.lstrip("/")
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(code + "\n", encoding="utf-8")
            print(f"   [+] Updated: {full_path.relative_to(PROJECT_ROOT)}")

    return {}

MAX_ITERATIONS = 5

def route_compilation(state: GraphState):
    errors = state.get("build_errors", [])
    iteration = state.get("iteration_count", 0)

    if not errors:
        return END
    if iteration >= MAX_ITERATIONS:
        print(f"\n   [!] Reached max healing iterations ({MAX_ITERATIONS}). Remaining error lines: {len(errors)}")
        return END
    return "developer"

# 4. Assemble and Compile the Self-Healing Graph
workflow = StateGraph(GraphState)
workflow.add_node("loader", loader_node)
workflow.add_node("compiler", compiler_node)
workflow.add_node("developer", developer_node)
workflow.add_node("writer", writer_node)

workflow.set_entry_point("loader")
workflow.add_edge("loader", "compiler")
workflow.add_conditional_edges("compiler", route_compilation, {"developer": "developer", END: END})
workflow.add_edge("developer", "writer")
workflow.add_edge("writer", "compiler")

app = workflow.compile()

if __name__ == "__main__":
    initial_state: GraphState = {
        "generated_files": {},
        "file_errors": {},
        "build_errors": [],
        "iteration_count": 0,
    }

    print(f"Starting Autonomous Compiler-Driven Self-Healing Loop (Root: {PROJECT_ROOT})...")
    app.invoke(initial_state)
    print("\nSelf-Healing Workflow Finished.")