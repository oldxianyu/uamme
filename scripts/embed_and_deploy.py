import json, os, requests

public_dir = "public"
assets = {}
mime = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8"}
for root, dirs, files in os.walk(public_dir):
    for f in files:
        fp = os.path.join(root, f)
        rel = "/" + os.path.relpath(fp, public_dir)
        ext = os.path.splitext(f)[1]
        with open(fp) as fh:
            assets[rel] = {"c": fh.read(), "m": mime.get(ext, "text/plain")}

with open(".wrangler/deploy/index.js") as f:
    worker = f.read()

sa_json = json.dumps(assets, ensure_ascii=False)

old_handler = """app.get("*", async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Static file serving not available in local dev", 404);
});"""

new_handler_lines = [
    'app.get("*", async (c) => {',
    '  var _a = self.__SA;',
    '  if (!_a) {',
    '    _a = ' + sa_json + ';',
    '    self.__SA = _a;',
    '  }',
    '  var _p = new URL(c.req.url).pathname;',
    '  if (_p === "/") _p = "/index.html";',
    '  var _e = _a[_p];',
    '  if (_e) {',
    '    var _h = new Headers();',
    '    _h.set("Content-Type", _e.m);',
    '    return new Response(_e.c, { headers: _h });',
    '  }',
    '  return new Response("Not Found", { status: 404 });',
    '});'
]
new_handler = "\n".join(new_handler_lines)

worker = worker.replace(old_handler, new_handler)

with open(".wrangler/deploy/embedded.js", "w") as f:
    f.write(worker)
print("Embedded OK:", len(worker), "bytes")

ACCOUNT_ID = "7fdaf966324927b4305cc31babc58b70"
DB_UUID = "c973b0d9-6058-4b8e-9d7a-acaa4b377b86"
metadata = {
    "main_module": "index.js",
    "bindings": [{"name": "DB", "type": "d1", "id": DB_UUID}],
    "compatibility_date": "2024-01-01",
    "compatibility_flags": ["nodejs_compat"]
}

url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/uamme"
headers = {
    "X-Auth-Email": "171801508@qq.com",
    "X-Auth-Key": "3a79ab12621daa8b2d23d0440edd5a3a6b648"
}

with open(".wrangler/deploy/embedded.js", "rb") as f:
    files = {
        "metadata": (None, json.dumps(metadata), "application/json"),
        "index.js": ("index.js", f, "application/javascript+module")
    }
    r = requests.put(url, headers=headers, files=files, timeout=60).json()
    print("Deploy:", "OK" if r.get("success") else "FAIL", r.get("errors", []))
