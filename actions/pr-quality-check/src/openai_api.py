"""OpenAI API and LLM interaction functions."""

import os
import time
from typing import Any, Dict, List, Tuple, Type
from pydantic import BaseModel
from openai import OpenAI
from .glob_match import matches_glob_pattern


# Typed openai structured responses

class IssueModel(BaseModel):
    rule_id: str
    reason: str

class FileAnalysisModel(BaseModel):
    file_path: str
    issues: List[IssueModel]

class ContextModel(BaseModel):
    context_files: List[str]
    reason: str = ""


def call_openai_and_parse_structured(api_key: str, model: str, system_prompt: str, user_prompt: str, schema: Type[BaseModel]) -> Dict[str, Any]:
    """Generic typed parse helper. Returns native dict from Pydantic model_dump()."""
    client = OpenAI(api_key=api_key)
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            resp = client.responses.parse(
                model=model,
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                text_format=schema,
            )
            parsed = resp.output_parsed  # type: ignore[attr-defined]
            # Optional debug logging of parsed structured response
            if str(os.getenv("LOG_PROMPTS", "false")).lower() == "true":
                try:
                    print(f"=== OpenAI parsed response ({getattr(schema, '__name__', 'Schema')}) ===")
                    print(parsed.model_dump_json(indent=2))
                except Exception:
                    try:
                        import json as _json
                        print(_json.dumps(parsed.model_dump(), indent=2, ensure_ascii=False))
                    except Exception:
                        print(str(parsed))
            return parsed.model_dump()
        except Exception as e:
            last_err = e
            time.sleep(1 + attempt)
    raise RuntimeError(f"OpenAI parse failed: {last_err}")


def analyze_file_given_rules_and_context(api_key: str, model: str, user_prompt: str) -> Dict[str, Any]:
    """Reviews a file given a set of rules and context."""
    return call_openai_and_parse_structured(api_key, model, "You are an expert code reviewer focused on code quality standards.", user_prompt, FileAnalysisModel)


def discover_context_for_rules(api_key: str, model: str, file_path: str, all_changed: List[str], rules: List[Dict[str, Any]], log_prompts: bool, load_prompt_func) -> Tuple[List[str], Dict[str, Any]]:
    """Use LLM to discover which context files are needed for rule validation (typed)."""
    context_files: List[str] = []
    per_rule: Dict[str, Any] = {}
    needs = [r for r in rules if bool(r.get("requires_context", False))]
    for r in needs:
        rid = r.get("id") or ""
        desc = r.get("description") or ""
        # Apply optional per-rule context filter to narrow candidate files
        cf_raw = r.get("context_filter")
        cf_list: List[str] = []
        if isinstance(cf_raw, str) and cf_raw.strip():
            cf_list = [cf_raw.strip()]
        elif isinstance(cf_raw, list):
            cf_list = [str(x).strip() for x in cf_raw if isinstance(x, str) and str(x).strip()]
        # Determine candidate changed files after filter (if any)
        if cf_list:
            candidates = [f for f in all_changed if any(matches_glob_pattern(f, pat) for pat in cf_list)]
            if log_prompts:
                try:
                    print(f"Context filter for rule {rid}: patterns={cf_list} → candidates={candidates}")
                except Exception:
                    pass
            if not candidates:
                # No candidates after filter — skip LLM and record empty context for this rule
                per_rule[rid] = {"context_files": [], "reason": "No candidate files after context_filter"}
                continue
        else:
            candidates = list(all_changed)
            if log_prompts:
                try:
                    print(f"Context filter for rule {rid}: no filter → all candidates={candidates}")
                except Exception:
                    pass
        prompt_template = load_prompt_func("context_discovery")
        candidates_list = "\n".join([f"- {f}" for f in candidates]) if candidates else "- (none)"
        prompt = prompt_template.format(
            rule_id=rid,
            description=desc,
            file_path=file_path,
            all_changed_files=candidates_list
        )
        if log_prompts:
            print(f"=== Context discovery prompt (rule: {rid}, file: {file_path}) ===")
            print(prompt)
        j = call_openai_and_parse_structured(
            api_key,
            model,
            "You are a coding context discovery assistant. Given a rule and a list of changed files, determine which context files are needed to validate the rule.",
            prompt,
            ContextModel,
        )
        files = [f for f in (j.get("context_files") or []) if isinstance(f, str)]
        # Accept only files that are within the candidate changed files set
        if files:
            before = set(files)
            files = [f for f in files if f in candidates]
            if log_prompts and before and set(files) != before:
                try:
                    removed = sorted(before - set(files))
                    kept = sorted(set(files))
                    print(f"Context discovery filtered out non-candidate files for rule {rid}: removed={removed} kept={kept}")
                except Exception:
                    pass
        if files:
            context_files.extend(files)
            per_rule[rid] = {"context_files": files, "reason": j.get("reason", "")}
        # on repeated failures, just continue (no files)
    context_files = sorted({f for f in context_files})
    return context_files, per_rule
