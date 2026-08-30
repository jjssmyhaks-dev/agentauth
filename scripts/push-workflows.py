import json, base64, urllib.request, urllib.error, os, sys

TOKEN = sys.argv[1]
REPO = "jjssmyhaks-dev/agentauth"
API = f"https://api.github.com/repos/{REPO}"
CWD = "/home/daytona/codebase"

def api_call(method, path, data=None):
    url = f"{API}{path}"
    headers = {
        "Authorization": f"token {TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "message": e.read().decode()[:300]}

workflows = [
    ".github/workflows/ci.yml",
    ".github/workflows/deploy.yml",
    ".github/workflows/publish-npm.yml",
    ".github/workflows/publish-pypi.yml",
]

for wf in workflows:
    filepath = os.path.join(CWD, wf)
    if not os.path.isfile(filepath):
        print(f"SKIP {wf}: not found locally"); continue
    with open(filepath, "r") as f:
        content = f.read()
    b64 = base64.b64encode(content.encode()).decode()
    result = api_call("PUT", f"/contents/{wf}", {
        "message": f"add: {wf}",
        "content": b64,
        "branch": "main",
    })
    if result and "content" in result:
        print(f"OK: {wf}")
    else:
        print(f"FAIL {wf}: {result.get('message', str(result.get('error', '')))[:150]}")
