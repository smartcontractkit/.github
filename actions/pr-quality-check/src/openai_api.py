"""OpenAI API and LLM interaction functions."""

import os
import time
from typing import Any, Dict, List, Tuple, Type
from pydantic import BaseModel
from openai import OpenAI


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
        prompt_template = load_prompt_func("context_discovery")
        prompt = prompt_template.format(
            rule_id=rid,
            description=desc,
            file_path=file_path,
            all_changed_files="\n".join(all_changed)
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
        if files:
            context_files.extend(files)
            per_rule[rid] = {"context_files": files, "reason": j.get("reason", "")}
        # on repeated failures, just continue (no files)
    context_files = sorted({f for f in context_files})
    return context_files, per_rule
