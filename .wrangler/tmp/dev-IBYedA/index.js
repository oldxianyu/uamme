var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-uZAMA8/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        if (opts.credentials) {
          return (origin) => origin || null;
        }
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*" || opts.credentials) {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*" || opts.credentials) {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// src/db/index.ts
async function dbGet(db, sql, ...args) {
  const stmt = db.prepare(sql).bind(...args);
  return await stmt.first() ?? null;
}
__name(dbGet, "dbGet");
async function dbAll(db, sql, ...args) {
  const stmt = db.prepare(sql).bind(...args);
  const result = await stmt.all();
  return result.results ?? [];
}
__name(dbAll, "dbAll");
async function dbRun(db, sql, ...args) {
  const stmt = db.prepare(sql).bind(...args);
  return await stmt.run();
}
__name(dbRun, "dbRun");
var dbInsert = dbRun;
function validateId(id) {
  const num = parseInt(id, 10);
  if (isNaN(num) || num <= 0 || !Number.isInteger(num)) return null;
  return num;
}
__name(validateId, "validateId");
function validateString(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}
__name(validateString, "validateString");
function validateUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
__name(validateUrl, "validateUrl");

// src/middleware/auth.ts
async function authMiddleware(c, next) {
  const authHeader = c.req.header("Authorization");
  const cookie = c.req.header("Cookie");
  let token = null;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
  if (!token && cookie) {
    const match2 = cookie.match(/session_token=([^;]+)/);
    if (match2) token = match2[1];
  }
  if (!token) {
    return c.json({ error: "\u672A\u767B\u5F55" }, 401);
  }
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return c.json({ error: "\u767B\u5F55\u51ED\u8BC1\u65E0\u6548" }, 401);
  }
  try {
    const session = await dbGet(
      c.env.DB,
      'SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime("now")',
      token
    );
    if (!session) {
      return c.json({ error: "\u767B\u5F55\u5DF2\u8FC7\u671F" }, 401);
    }
    c.set("userId", session.user_id);
    await next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return c.json({ error: "\u8BA4\u8BC1\u670D\u52A1\u5F02\u5E38" }, 500);
  }
}
__name(authMiddleware, "authMiddleware");

// src/routes/auth.ts
var authRoutes = new Hono2();
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, storedHash) {
  if (storedHash.startsWith("pbkdf2:")) {
    const [, iterations, saltHex, expectedHash] = storedHash.split(":");
    const encoder = new TextEncoder();
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const hash = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: parseInt(iterations), hash: "SHA-256" },
      keyMaterial,
      256
    );
    const computedHash = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return timingSafeEqual(computedHash, expectedHash);
  }
  if (storedHash.startsWith("sha256:")) {
    const inputHash = await sha256(password);
    return timingSafeEqual(inputHash, storedHash.slice(7));
  }
  return false;
}
__name(verifyPassword, "verifyPassword");
async function sha256(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateToken, "generateToken");
var loginAttempts = /* @__PURE__ */ new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1e3 });
    return true;
  }
  if (record.count >= 5) return false;
  record.count++;
  return true;
}
__name(checkRateLimit, "checkRateLimit");
authRoutes.post("/login", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
  if (!checkRateLimit(ip)) {
    return c.json({ error: "\u767B\u5F55\u5C1D\u8BD5\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7 15 \u5206\u949F\u540E\u91CD\u8BD5" }, 429);
  }
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400);
  }
  const { username, password } = body;
  if (!username || !password) {
    return c.json({ error: "\u8BF7\u8F93\u5165\u7528\u6237\u540D\u548C\u5BC6\u7801" }, 400);
  }
  if (typeof username !== "string" || typeof password !== "string") {
    return c.json({ error: "\u53C2\u6570\u7C7B\u578B\u9519\u8BEF" }, 400);
  }
  if (username.length > 50 || password.length > 128) {
    return c.json({ error: "\u8F93\u5165\u8FC7\u957F" }, 400);
  }
  const user = await dbGet(
    c.env.DB,
    "SELECT id, username, password_hash, display_name FROM users WHERE username = ?",
    username
  );
  if (!user) {
    return c.json({ error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
  }
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.json({ error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
  }
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString();
  await dbInsert(
    c.env.DB,
    "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
    user.id,
    token,
    expiresAt
  );
  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name
    }
  });
});
authRoutes.post("/logout", authMiddleware, async (c) => {
  const token = c.req.header("Authorization")?.slice(7) || "";
  if (token) {
    await dbRun(c.env.DB, "DELETE FROM sessions WHERE token = ?", token);
  }
  return c.json({ ok: true });
});
authRoutes.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const user = await dbGet(
    c.env.DB,
    "SELECT id, username, display_name, avatar_url FROM users WHERE id = ?",
    userId
  );
  if (!user) {
    return c.json({ error: "\u7528\u6237\u4E0D\u5B58\u5728" }, 404);
  }
  return c.json({ user });
});
authRoutes.post("/change-password", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const { oldPassword, newPassword } = await c.req.json();
  if (!oldPassword || !newPassword) {
    return c.json({ error: "\u8BF7\u8F93\u5165\u65E7\u5BC6\u7801\u548C\u65B0\u5BC6\u7801" }, 400);
  }
  if (newPassword.length < 6) {
    return c.json({ error: "\u65B0\u5BC6\u7801\u81F3\u5C11 6 \u4F4D" }, 400);
  }
  const user = await dbGet(
    c.env.DB,
    "SELECT id, password_hash FROM users WHERE id = ?",
    userId
  );
  if (!user || !await verifyPassword(oldPassword, user.password_hash)) {
    return c.json({ error: "\u65E7\u5BC6\u7801\u9519\u8BEF" }, 401);
  }
  const newHash = await hashPassword(newPassword);
  await dbRun(c.env.DB, 'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', newHash, userId);
  return c.json({ ok: true });
});

// src/routes/webhook.ts
var webhookRoutes = new Hono2();
webhookRoutes.use("*", authMiddleware);
webhookRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const webhooks = await dbAll(
    c.env.DB,
    "SELECT * FROM webhook_configs WHERE user_id = ? ORDER BY created_at DESC",
    userId
  );
  return c.json({ webhooks });
});
webhookRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  const webhook = await dbGet(
    c.env.DB,
    "SELECT * FROM webhook_configs WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!webhook) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  return c.json({ webhook });
});
webhookRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400);
  }
  const name = validateString(body.name, 100);
  const webhook_url = validateString(body.webhook_url, 500);
  const description = validateString(body.description, 500);
  if (!name || !webhook_url) {
    return c.json({ error: "\u540D\u79F0\u548C Webhook URL \u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  if (!validateUrl(webhook_url)) {
    return c.json({ error: "Webhook URL \u683C\u5F0F\u65E0\u6548\uFF0C\u4EC5\u652F\u6301 http/https" }, 400);
  }
  const result = await dbInsert(
    c.env.DB,
    "INSERT INTO webhook_configs (user_id, name, webhook_url, description) VALUES (?, ?, ?, ?)",
    userId,
    name,
    webhook_url,
    description
  );
  const webhook = await dbGet(c.env.DB, "SELECT * FROM webhook_configs WHERE id = ?", result.meta.last_row_id);
  return c.json({ webhook }, 201);
});
webhookRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400);
  }
  const name = validateString(body.name, 100);
  const webhook_url = validateString(body.webhook_url, 500);
  const description = validateString(body.description, 500);
  const is_active = body.is_active === 1 || body.is_active === 0 ? body.is_active : 1;
  if (!name || !webhook_url) {
    return c.json({ error: "\u540D\u79F0\u548C URL \u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  if (!validateUrl(webhook_url)) {
    return c.json({ error: "Webhook URL \u683C\u5F0F\u65E0\u6548" }, 400);
  }
  const existing = await dbGet(
    c.env.DB,
    "SELECT * FROM webhook_configs WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!existing) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  await dbRun(
    c.env.DB,
    `UPDATE webhook_configs SET name = ?, webhook_url = ?, description = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?`,
    name,
    webhook_url,
    description,
    is_active,
    id
  );
  const webhook = await dbGet(c.env.DB, "SELECT * FROM webhook_configs WHERE id = ?", id);
  return c.json({ webhook });
});
webhookRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  const existing = await dbGet(
    c.env.DB,
    "SELECT * FROM webhook_configs WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!existing) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  await dbRun(c.env.DB, "DELETE FROM webhook_configs WHERE id = ?", id);
  return c.json({ ok: true });
});
webhookRoutes.post("/:id/test", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  let body;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const webhook = await dbGet(
    c.env.DB,
    "SELECT * FROM webhook_configs WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!webhook) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  const allowedDomains = ["qyapi.weixin.qq.com"];
  try {
    const url = new URL(webhook.webhook_url);
    if (!allowedDomains.includes(url.hostname)) {
      return c.json({ error: "\u4EC5\u5141\u8BB8\u63A8\u9001\u5230\u4F01\u4E1A\u5FAE\u4FE1\u57DF\u540D" }, 403);
    }
  } catch {
    return c.json({ error: "Webhook URL \u65E0\u6548" }, 400);
  }
  const text = validateString(body.content, 2e3) || "\u{1F3D3} \u4F18\u5B89\u7C73\u6D4B\u8BD5\u63A8\u9001\n\n\u8FD9\u662F\u4E00\u6761\u6765\u81EA\u4F18\u5B89\u7C73\u5E73\u53F0\u7684\u6D4B\u8BD5\u6D88\u606F\u3002";
  const format = body.format === "markdown" ? "markdown" : "text";
  let payload;
  if (format === "markdown") {
    payload = { msgtype: "markdown", markdown: { content: text } };
  } else {
    payload = { msgtype: "text", text: { content: text } };
  }
  try {
    const resp = await fetch(webhook.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const respText = await resp.text();
    let respJson;
    try {
      respJson = JSON.parse(respText);
    } catch {
      respJson = null;
    }
    const success = respJson?.errcode === 0;
    await dbInsert(
      c.env.DB,
      `INSERT INTO push_logs (user_id, webhook_id, title, body_preview, status, response_code, response_body, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      userId,
      id,
      "\u6D4B\u8BD5\u63A8\u9001",
      text.slice(0, 200),
      success ? "success" : "failed",
      resp.status,
      respText.slice(0, 1e3),
      success ? "" : respJson?.errmsg || "\u63A8\u9001\u5931\u8D25"
    );
    return c.json({ ok: success, response: respJson, status: resp.status });
  } catch (err) {
    await dbInsert(
      c.env.DB,
      `INSERT INTO push_logs (user_id, webhook_id, title, body_preview, status, error_message)
       VALUES (?, ?, ?, ?, 'failed', ?)`,
      userId,
      id,
      "\u6D4B\u8BD5\u63A8\u9001",
      text.slice(0, 200),
      err.message
    );
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// src/routes/template.ts
var templateRoutes = new Hono2();
templateRoutes.use("*", authMiddleware);
templateRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const templates = await dbAll(
    c.env.DB,
    "SELECT * FROM message_templates WHERE user_id = ? ORDER BY created_at DESC",
    userId
  );
  return c.json({ templates });
});
templateRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  const template = await dbGet(
    c.env.DB,
    "SELECT * FROM message_templates WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!template) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  return c.json({ template });
});
templateRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400);
  }
  const name = validateString(body.name, 100);
  const format = ["text", "markdown"].includes(body.format) ? body.format : "text";
  const content = validateString(body.content, 5e3);
  const description = validateString(body.description, 500);
  if (!name || !content) {
    return c.json({ error: "\u540D\u79F0\u548C\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  const result = await dbInsert(
    c.env.DB,
    "INSERT INTO message_templates (user_id, name, format, content, description) VALUES (?, ?, ?, ?, ?)",
    userId,
    name,
    format,
    content,
    description
  );
  const template = await dbGet(c.env.DB, "SELECT * FROM message_templates WHERE id = ?", result.meta.last_row_id);
  return c.json({ template }, 201);
});
templateRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400);
  }
  const name = validateString(body.name, 100);
  const format = ["text", "markdown"].includes(body.format) ? body.format : "text";
  const content = validateString(body.content, 5e3);
  const description = validateString(body.description, 500);
  if (!name || !content) {
    return c.json({ error: "\u540D\u79F0\u548C\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  const existing = await dbGet(
    c.env.DB,
    "SELECT * FROM message_templates WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!existing) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  await dbRun(
    c.env.DB,
    `UPDATE message_templates SET name = ?, format = ?, content = ?, description = ?, updated_at = datetime('now') WHERE id = ?`,
    name,
    format,
    content,
    description,
    id
  );
  const template = await dbGet(c.env.DB, "SELECT * FROM message_templates WHERE id = ?", id);
  return c.json({ template });
});
templateRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  const existing = await dbGet(
    c.env.DB,
    "SELECT * FROM message_templates WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!existing) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  await dbRun(c.env.DB, "DELETE FROM message_templates WHERE id = ?", id);
  return c.json({ ok: true });
});
templateRoutes.post("/:id/preview", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  let body;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const template = await dbGet(
    c.env.DB,
    "SELECT * FROM message_templates WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!template) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  let preview = template.content;
  const variables = body.variables || {};
  if (typeof variables === "object") {
    for (const [key, value] of Object.entries(variables)) {
      const safeKey = validateString(key, 50);
      const safeValue = validateString(String(value), 500);
      if (safeKey) {
        preview = preview.replace(new RegExp(`\\{\\{${safeKey}\\}\\}`, "g"), safeValue);
      }
    }
  }
  return c.json({ preview, format: template.format });
});

// src/routes/content.ts
var contentSourceRoutes = new Hono2();
contentSourceRoutes.use("*", authMiddleware);
contentSourceRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const sources = await dbAll(
    c.env.DB,
    "SELECT * FROM content_sources WHERE user_id = ? ORDER BY created_at DESC",
    userId
  );
  return c.json({ sources });
});
contentSourceRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  const source = await dbGet(
    c.env.DB,
    "SELECT * FROM content_sources WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!source) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  return c.json({ source });
});
contentSourceRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400);
  }
  const name = validateString(body.name, 100);
  const source_type = validateString(body.source_type, 50);
  const source_url = validateString(body.source_url, 500);
  const keyword = validateString(body.keyword, 200);
  const fetch_interval = Math.min(Math.max(parseInt(body.fetch_interval) || 3600, 60), 86400);
  const config = validateString(body.config, 2e3);
  if (!name || !source_type) {
    return c.json({ error: "\u540D\u79F0\u548C\u7C7B\u578B\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  const validTypes = ["rss", "website", "keyword", "article"];
  if (!validTypes.includes(source_type)) {
    return c.json({ error: "\u65E0\u6548\u7684\u5185\u5BB9\u7C7B\u578B" }, 400);
  }
  if (source_url && !validateUrl(source_url)) {
    return c.json({ error: "URL \u683C\u5F0F\u65E0\u6548" }, 400);
  }
  const result = await dbInsert(
    c.env.DB,
    "INSERT INTO content_sources (user_id, name, source_type, source_url, keyword, fetch_interval, config) VALUES (?, ?, ?, ?, ?, ?, ?)",
    userId,
    name,
    source_type,
    source_url,
    keyword,
    fetch_interval,
    config || "{}"
  );
  const source = await dbGet(c.env.DB, "SELECT * FROM content_sources WHERE id = ?", result.meta.last_row_id);
  return c.json({ source }, 201);
});
contentSourceRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400);
  }
  const name = validateString(body.name, 100);
  const source_type = validateString(body.source_type, 50);
  const source_url = validateString(body.source_url, 500);
  const keyword = validateString(body.keyword, 200);
  const fetch_interval = Math.min(Math.max(parseInt(body.fetch_interval) || 3600, 60), 86400);
  const is_active = body.is_active === 1 || body.is_active === 0 ? body.is_active : 1;
  const config = validateString(body.config, 2e3);
  if (!name || !source_type) {
    return c.json({ error: "\u540D\u79F0\u548C\u7C7B\u578B\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  const existing = await dbGet(
    c.env.DB,
    "SELECT * FROM content_sources WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!existing) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  await dbRun(
    c.env.DB,
    `UPDATE content_sources SET name=?, source_type=?, source_url=?, keyword=?, fetch_interval=?, is_active=?, config=?, updated_at=datetime('now') WHERE id=?`,
    name,
    source_type,
    source_url,
    keyword,
    fetch_interval,
    is_active,
    config || "{}",
    id
  );
  const source = await dbGet(c.env.DB, "SELECT * FROM content_sources WHERE id = ?", id);
  return c.json({ source });
});
contentSourceRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  const existing = await dbGet(
    c.env.DB,
    "SELECT * FROM content_sources WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!existing) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  await dbRun(c.env.DB, "DELETE FROM content_sources WHERE id = ?", id);
  return c.json({ ok: true });
});
contentSourceRoutes.post("/:id/test", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  const source = await dbGet(
    c.env.DB,
    "SELECT * FROM content_sources WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!source) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  if (source.source_url) {
    try {
      const url = new URL(source.source_url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return c.json({ error: "\u4EC5\u652F\u6301 http/https URL" }, 400);
      }
      const hostname = url.hostname;
      if (hostname === "localhost" || hostname.startsWith("127.") || hostname.startsWith("10.") || hostname.startsWith("192.168.") || hostname === "0.0.0.0" || hostname === "[::1]") {
        return c.json({ error: "\u4E0D\u5141\u8BB8\u8BBF\u95EE\u5185\u7F51\u5730\u5740" }, 403);
      }
    } catch {
      return c.json({ error: "URL \u683C\u5F0F\u65E0\u6548" }, 400);
    }
  }
  try {
    let content = "";
    if (source.source_type === "rss" && source.source_url) {
      const resp = await fetch(source.source_url, {
        signal: AbortSignal.timeout(1e4)
        // 10s timeout
      });
      const text = await resp.text();
      const titles = text.match(/<title[^>]*>([^<]+)<\/title>/gi) || [];
      content = titles.slice(0, 5).map((t) => t.replace(/<\/?title[^>]*>/gi, "")).join("\n");
    } else if (source.source_type === "website" && source.source_url) {
      const resp = await fetch(source.source_url, {
        signal: AbortSignal.timeout(1e4)
      });
      content = (await resp.text()).slice(0, 2e3);
    } else if (source.source_type === "keyword" && source.keyword) {
      content = `\u5173\u952E\u8BCD"${source.keyword}"\u7684\u5185\u5BB9\u6293\u53D6\u529F\u80FD\u5F00\u53D1\u4E2D...`;
    } else if (source.source_type === "article" && source.source_url) {
      const resp = await fetch(source.source_url, {
        signal: AbortSignal.timeout(1e4)
      });
      content = (await resp.text()).slice(0, 2e3);
    }
    return c.json({ ok: true, content: content.slice(0, 2e3) });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// src/routes/custom.ts
var customContentRoutes = new Hono2();
customContentRoutes.use("*", authMiddleware);
customContentRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const contents = await dbAll(
    c.env.DB,
    "SELECT * FROM custom_contents WHERE user_id = ? ORDER BY created_at DESC",
    userId
  );
  return c.json({ contents });
});
customContentRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  const content = await dbGet(
    c.env.DB,
    "SELECT * FROM custom_contents WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!content) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  return c.json({ content });
});
customContentRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400);
  }
  const title = validateString(body.title, 200);
  const contentBody = validateString(body.body, 1e4);
  const template_id = body.template_id ? validateId(String(body.template_id)) : null;
  if (!title) {
    return c.json({ error: "\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  const result = await dbInsert(
    c.env.DB,
    "INSERT INTO custom_contents (user_id, title, body, template_id) VALUES (?, ?, ?, ?)",
    userId,
    title,
    contentBody,
    template_id
  );
  const content = await dbGet(c.env.DB, "SELECT * FROM custom_contents WHERE id = ?", result.meta.last_row_id);
  return c.json({ content }, 201);
});
customContentRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400);
  }
  const title = validateString(body.title, 200);
  const contentBody = validateString(body.body, 1e4);
  const template_id = body.template_id ? validateId(String(body.template_id)) : null;
  if (!title) {
    return c.json({ error: "\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A" }, 400);
  }
  const existing = await dbGet(
    c.env.DB,
    "SELECT * FROM custom_contents WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!existing) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  await dbRun(
    c.env.DB,
    `UPDATE custom_contents SET title=?, body=?, template_id=?, updated_at=datetime('now') WHERE id=?`,
    title,
    contentBody,
    template_id,
    id
  );
  const content = await dbGet(c.env.DB, "SELECT * FROM custom_contents WHERE id = ?", id);
  return c.json({ content });
});
customContentRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  const existing = await dbGet(
    c.env.DB,
    "SELECT * FROM custom_contents WHERE id = ? AND user_id = ?",
    id,
    userId
  );
  if (!existing) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  await dbRun(c.env.DB, "DELETE FROM custom_contents WHERE id = ?", id);
  return c.json({ ok: true });
});

// src/routes/push.ts
var pushRoutes = new Hono2();
pushRoutes.use("*", authMiddleware);
pushRoutes.get("/logs", async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = Math.max(parseInt(c.req.query("offset") || "0"), 0);
  const logs = await dbAll(
    c.env.DB,
    `SELECT pl.*, wc.name as webhook_name, mt.name as template_name
     FROM push_logs pl
     LEFT JOIN webhook_configs wc ON pl.webhook_id = wc.id
     LEFT JOIN message_templates mt ON pl.template_id = mt.id
     WHERE pl.user_id = ?
     ORDER BY pl.created_at DESC
     LIMIT ? OFFSET ?`,
    userId,
    limit,
    offset
  );
  const total = await dbGet(
    c.env.DB,
    "SELECT COUNT(*) as count FROM push_logs WHERE user_id = ?",
    userId
  );
  return c.json({ logs, total: total?.count || 0 });
});
pushRoutes.get("/logs/:id", async (c) => {
  const userId = c.get("userId");
  const id = validateId(c.req.param("id"));
  if (id === null) return c.json({ error: "\u65E0\u6548 ID" }, 400);
  const log = await dbGet(
    c.env.DB,
    `SELECT pl.*, wc.name as webhook_name, wc.webhook_url, mt.name as template_name, mt.content as template_content
     FROM push_logs pl
     LEFT JOIN webhook_configs wc ON pl.webhook_id = wc.id
     LEFT JOIN message_templates mt ON pl.template_id = mt.id
     WHERE pl.id = ? AND pl.user_id = ?`,
    id,
    userId
  );
  if (!log) return c.json({ error: "\u672A\u627E\u5230" }, 404);
  return c.json({ log });
});
pushRoutes.post("/send", async (c) => {
  const userId = c.get("userId");
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400);
  }
  const webhook_id = validateId(String(body.webhook_id));
  if (webhook_id === null) {
    return c.json({ error: "\u8BF7\u9009\u62E9 Webhook" }, 400);
  }
  const template_id = body.template_id ? validateId(String(body.template_id)) : null;
  const custom_content_id = body.custom_content_id ? validateId(String(body.custom_content_id)) : null;
  const content_source_id = body.content_source_id ? validateId(String(body.content_source_id)) : null;
  const webhook = await dbGet(
    c.env.DB,
    "SELECT * FROM webhook_configs WHERE id = ? AND user_id = ?",
    webhook_id,
    userId
  );
  if (!webhook) return c.json({ error: "Webhook \u4E0D\u5B58\u5728" }, 404);
  const allowedDomains = ["qyapi.weixin.qq.com"];
  try {
    const url = new URL(webhook.webhook_url);
    if (!allowedDomains.includes(url.hostname)) {
      return c.json({ error: "\u4EC5\u5141\u8BB8\u63A8\u9001\u5230\u4F01\u4E1A\u5FAE\u4FE1\u57DF\u540D" }, 403);
    }
  } catch {
    return c.json({ error: "Webhook URL \u65E0\u6548" }, 400);
  }
  let title = "";
  let contentBody = "";
  if (custom_content_id) {
    const content = await dbGet(
      c.env.DB,
      "SELECT * FROM custom_contents WHERE id = ? AND user_id = ?",
      custom_content_id,
      userId
    );
    if (content) {
      title = content.title;
      contentBody = content.body;
    }
  } else if (content_source_id) {
    const source = await dbGet(
      c.env.DB,
      "SELECT * FROM content_sources WHERE id = ? AND user_id = ?",
      content_source_id,
      userId
    );
    if (source) {
      title = source.name;
      contentBody = `[${source.source_type}] ${source.source_url || source.keyword}`;
    }
  }
  if (!contentBody) {
    return c.json({ error: "\u8BF7\u9009\u62E9\u8981\u63A8\u9001\u7684\u5185\u5BB9" }, 400);
  }
  let pushBody = contentBody;
  if (template_id) {
    const template = await dbGet(
      c.env.DB,
      "SELECT * FROM message_templates WHERE id = ? AND user_id = ?",
      template_id,
      userId
    );
    if (template) {
      pushBody = template.content.replace(/\{\{title\}\}/g, title).replace(/\{\{body\}\}/g, contentBody);
    }
  }
  const format = body.format === "markdown" ? "markdown" : "text";
  let payload;
  if (format === "markdown") {
    payload = { msgtype: "markdown", markdown: { content: pushBody } };
  } else {
    payload = { msgtype: "text", text: { content: pushBody } };
  }
  try {
    const resp = await fetch(webhook.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const respText = await resp.text();
    let respJson;
    try {
      respJson = JSON.parse(respText);
    } catch {
      respJson = null;
    }
    const success = respJson?.errcode === 0;
    await dbInsert(
      c.env.DB,
      `INSERT INTO push_logs (user_id, webhook_id, template_id, content_source_id, custom_content_id, title, body_preview, status, response_code, response_body, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      userId,
      webhook_id,
      template_id || null,
      content_source_id || null,
      custom_content_id || null,
      title,
      pushBody.slice(0, 200),
      success ? "success" : "failed",
      resp.status,
      respText.slice(0, 1e3),
      success ? "" : respJson?.errmsg || "\u63A8\u9001\u5931\u8D25"
    );
    return c.json({ ok: success, response: respJson, status: resp.status });
  } catch (err) {
    await dbInsert(
      c.env.DB,
      `INSERT INTO push_logs (user_id, webhook_id, template_id, title, body_preview, status, error_message)
       VALUES (?, ?, ?, ?, ?, 'failed', ?)`,
      userId,
      webhook_id,
      template_id || null,
      title,
      pushBody.slice(0, 200),
      err.message
    );
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// src/routes/dashboard.ts
var dashboardRoutes = new Hono2();
dashboardRoutes.use("*", authMiddleware);
dashboardRoutes.get("/stats", async (c) => {
  const userId = c.get("userId");
  const webhooks = await dbGet(
    c.env.DB,
    "SELECT COUNT(*) as count FROM webhook_configs WHERE user_id = ?",
    userId
  );
  const templates = await dbGet(
    c.env.DB,
    "SELECT COUNT(*) as count FROM message_templates WHERE user_id = ?",
    userId
  );
  const sources = await dbGet(
    c.env.DB,
    "SELECT COUNT(*) as count FROM content_sources WHERE user_id = ?",
    userId
  );
  const customContents = await dbGet(
    c.env.DB,
    "SELECT COUNT(*) as count FROM custom_contents WHERE user_id = ?",
    userId
  );
  const totalPushes = await dbGet(
    c.env.DB,
    "SELECT COUNT(*) as count FROM push_logs WHERE user_id = ?",
    userId
  );
  const successPushes = await dbGet(
    c.env.DB,
    "SELECT COUNT(*) as count FROM push_logs WHERE user_id = ? AND status = 'success'",
    userId
  );
  const failedPushes = await dbGet(
    c.env.DB,
    "SELECT COUNT(*) as count FROM push_logs WHERE user_id = ? AND status = 'failed'",
    userId
  );
  return c.json({
    stats: {
      webhooks: webhooks?.count || 0,
      templates: templates?.count || 0,
      sources: sources?.count || 0,
      customContents: customContents?.count || 0,
      totalPushes: totalPushes?.count || 0,
      successPushes: successPushes?.count || 0,
      failedPushes: failedPushes?.count || 0
    }
  });
});
dashboardRoutes.get("/recent-pushes", async (c) => {
  const userId = c.get("userId");
  const logs = await dbAll(
    c.env.DB,
    `SELECT pl.*, wc.name as webhook_name
     FROM push_logs pl
     LEFT JOIN webhook_configs wc ON pl.webhook_id = wc.id
     WHERE pl.user_id = ?
     ORDER BY pl.created_at DESC
     LIMIT 10`,
    userId
  );
  return c.json({ logs });
});
dashboardRoutes.get("/recent-failures", async (c) => {
  const userId = c.get("userId");
  const logs = await dbAll(
    c.env.DB,
    `SELECT pl.*, wc.name as webhook_name
     FROM push_logs pl
     LEFT JOIN webhook_configs wc ON pl.webhook_id = wc.id
     WHERE pl.user_id = ? AND pl.status = 'failed'
     ORDER BY pl.created_at DESC
     LIMIT 10`,
    userId
  );
  return c.json({ logs });
});

// src/routes/api.ts
var apiRoutes = new Hono2();
apiRoutes.route("/auth", authRoutes);
apiRoutes.route("/webhooks", webhookRoutes);
apiRoutes.route("/templates", templateRoutes);
apiRoutes.route("/content-sources", contentSourceRoutes);
apiRoutes.route("/custom-contents", customContentRoutes);
apiRoutes.route("/push", pushRoutes);
apiRoutes.route("/dashboard", dashboardRoutes);

// src/index.ts
var app = new Hono2();
app.use("/api/*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400
}));
app.route("/api", apiRoutes);
app.get("*", async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  try {
    const url = new URL(c.req.url);
    let path = url.pathname;
    if (path === "/") path = "/index.html";
    if (path.endsWith("/")) path += "index.html";
    const fs = await import("node:fs/promises");
    const { join } = await import("node:path");
    const filePath = join(process.cwd(), "public", path);
    const content = await fs.readFile(filePath);
    const ext = path.split(".").pop() || "html";
    const mimeTypes = {
      html: "text/html; charset=utf-8",
      css: "text/css; charset=utf-8",
      js: "application/javascript; charset=utf-8",
      json: "application/json; charset=utf-8",
      png: "image/png",
      jpg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      woff: "font/woff",
      woff2: "font/woff2"
    };
    return new Response(content, {
      headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream" }
    });
  } catch {
    return c.text("Not Found", 404);
  }
});
app.onError((err, c) => {
  console.error("Worker error:", err);
  return c.json({ error: "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF" }, 500);
});
var src_default = app;

// ../../../../usr/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../usr/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-uZAMA8/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../usr/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-uZAMA8/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
