"""OpenAI API and LLM interaction functions."""

import json
import re
import time
import requests
from typing import Any, Dict, List, Tuple


def openai_chat(api_key: str, model: str, messages: List[Dict[str, str]], response_format: str = "text") -> str:
    """Send chat completion request to OpenAI API with simple retries."""
    payload: Dict[str, Any] = {"model": model, "messages": messages}
    if response_format == "json_object":
        payload["response_format"] = {"type": "json_object"}

    last_err = None
    for attempt in range(3):
        try:
            r = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=120,
            )
            if r.status_code == 429:
                # rate limited: honor Retry-After if present
                wait_s = int(r.headers.get("Retry-After", "1"))
                time.sleep(min(wait_s, 10))
                last_err = RuntimeError(f"OpenAI rate limited: {r.text}")
                continue
            if r.status_code >= 500:
                last_err = RuntimeError(f"OpenAI server error {r.status_code}: {r.text}")
                time.sleep(1 + attempt)
                continue
            if r.status_code >= 400:
                raise RuntimeError(f"OpenAI error {r.status_code}: {r.text}")
            j = r.json()
            c = j.get("choices", [{}])[0].get("message", {}).get("content") or j.get("choices", [{}])[0].get("text") or ""
            return c
        except requests.RequestException as e:
            last_err = e
            time.sleep(1 + attempt)
    # final failure
    if last_err:
        raise last_err
    return ""


def discover_context_for_rules(api_key: str, model: str, file_path: str, all_changed: List[str], rules: List[Dict[str, Any]], log_prompts: bool, load_prompt_func) -> Tuple[List[str], Dict[str, Any]]:
    """Use LLM to discover which context files are needed for rule validation."""
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
        resp = openai_chat(api_key, model, [
            {"role": "system", "content": "You are precise. Respond ONLY with a JSON object. No prose."},
            {"role": "user", "content": prompt},
        ], response_format="json_object")
        resp = re.sub(r"^```json\s*|\s*```$", "", resp.strip(), flags=re.IGNORECASE | re.MULTILINE)
        try:
            j = json.loads(resp)
        except Exception:
            j = {"context_files": [], "reason": "invalid-json"}
        files = [f for f in (j.get("context_files") or []) if isinstance(f, str)]
        if files:
            context_files.extend(files)
            per_rule[rid] = {"context_files": files, "reason": j.get("reason", "")}            
    context_files = sorted({f for f in context_files})
    return context_files, per_rule
