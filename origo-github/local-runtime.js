/* Local stand-in for the claude.ai artifact runtime, so the GitHub Pages copy
   of Origo is fully usable without a claude.ai account.
   - db:   document store in localStorage, shared by every tab of this browser
   - user: this tab is the teacher (can edit) unless the URL has ?opiskelija
   - room: presence and messages between tabs via BroadcastChannel
   - sample (AI) is not provided, so the AI tab shows its "not available" note.
   Data never leaves the visitor's browser. Does nothing inside claude.ai. */
(() => {
  if (window.claude?.use) return;

  const KEY = "origo.localdb";
  const isStudent = /[?&]opiskelija\b/.test(location.search);
  const ss = (() => { try { return sessionStorage; } catch { return null; } })();
  const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  // one teacher id per browser, one student id per tab so several students can be opened
  const uid = (() => {
    const k = isStudent ? "origo.local.student" : "origo.local.teacher";
    const store = isStudent ? ss : localStorage;
    try { let v = store?.getItem(k); if (!v) { v = (isStudent ? "s-" : "t-") + rid(); store?.setItem(k, v); } return v; }
    catch { return (isStudent ? "s-" : "t-") + rid(); }
  })();

  /* ---------- db ---------- */
  let docs = {};
  const load = () => { try { docs = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { docs = {}; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(docs)); } catch {} };
  load();

  const listeners = new Set();
  const notify = () => queueMicrotask(() => listeners.forEach(fn => { try { fn(); } catch (e) { console.warn(e); } }));
  const write = fn => { load(); fn(); save(); notify(); };
  addEventListener("storage", e => { if (e.key === KEY) { load(); notify(); } });

  const clean = p => String(p).replace(/^\/+|\/+$/g, "");
  const parentOf = p => p.slice(0, p.lastIndexOf("/"));
  const docSnap = path => {
    const d = docs[path];
    return { id: path.slice(path.lastIndexOf("/") + 1), exists: !!d, data: () => (d ? structuredClone(d) : undefined) };
  };
  const copy = v => JSON.parse(JSON.stringify(v ?? {}));

  function query(path, order = null, max = Infinity) {
    const run = () => {
      let list = Object.keys(docs).filter(k => parentOf(k) === path).map(docSnap);
      if (order) list.sort((a, b) => { const x = a.data()[order], y = b.data()[order]; return x < y ? -1 : x > y ? 1 : 0; });
      list = list.slice(0, max);
      return { docs: list, size: list.length, empty: !list.length, forEach: f => list.forEach(f) };
    };
    return {
      orderBy: f => query(path, f, max),
      limit: n => query(path, order, n),
      get: async () => run(),
      onSnapshot(cb) {
        const fn = () => cb(run());
        listeners.add(fn); queueMicrotask(fn);
        return () => listeners.delete(fn);
      }
    };
  }

  function docRef(path) {
    path = clean(path);
    return {
      id: path.slice(path.lastIndexOf("/") + 1),
      get: async () => docSnap(path),
      set: async (data, opts) => write(() => { docs[path] = opts?.merge ? { ...docs[path], ...copy(data) } : copy(data); }),
      update: async data => {
        load();
        if (!docs[path]) throw new Error("No document to update: " + path);
        write(() => { docs[path] = { ...docs[path], ...copy(data) }; });
      },
      delete: async () => write(() => {
        delete docs[path];
        Object.keys(docs).forEach(k => { if (k.startsWith(path + "/")) delete docs[k]; });
      }),
      onSnapshot(cb) {
        const fn = () => cb(docSnap(path));
        listeners.add(fn); queueMicrotask(fn);
        return () => listeners.delete(fn);
      }
    };
  }

  const db = {
    doc: docRef,
    collection(path) {
      path = clean(path);
      return {
        ...query(path),
        doc: id => docRef(path + "/" + (id ?? rid())),
        add: async data => { const ref = docRef(path + "/" + rid()); await ref.set(data); return ref; }
      };
    }
  };

  /* ---------- user ---------- */
  const user = {
    canEdit: async () => !isStudent,
    id: async () => uid,
    profiles: async ids => Object.fromEntries(ids.map(id => [id, {
      name: id.startsWith("t-") ? "Opettaja" : "Opiskelija " + id.slice(2, 6).toUpperCase(),
      avatarUrl: ""
    }]))
  };

  /* ---------- room ---------- */
  const chan = "BroadcastChannel" in window ? new BroadcastChannel("origo.local.room") : null;
  const me = { by: uid, kind: isStudent ? "viewer" : "editor", tab: rid() };
  let myPresence = null;
  const peers = new Map();                    // tab -> {peer, seen}
  const peerCbs = new Set(), msgCbs = new Map();
  const emitPeers = () => {
    const now = Date.now();
    peers.forEach((v, k) => { if (now - v.seen > 15000) peers.delete(k); });
    const list = [{ ...me, presence: myPresence, isMe: true }, ...[...peers.values()].map(v => v.peer)];
    peerCbs.forEach(cb => cb({ peers: list }));
  };
  const post = m => chan?.postMessage({ ...m, from: me.tab });
  const beat = () => post({ t: "hi", peer: { by: me.by, kind: me.kind, presence: myPresence } });
  if (chan) {
    chan.onmessage = ({ data: m }) => {
      if (!m || m.from === me.tab) return;
      if (m.t === "hi" || m.t === "hello") {
        const known = peers.has(m.from);
        peers.set(m.from, { peer: m.peer, seen: Date.now() });
        if (m.t === "hello" || !known) beat();
        emitPeers();
      } else if (m.t === "bye") { peers.delete(m.from); emitPeers(); }
      else if (m.t === "msg") (msgCbs.get(m.type) || []).forEach(cb => cb({ data: m.data, by: m.by, isMe: false }));
    };
    setInterval(() => { beat(); emitPeers(); }, 5000);
    addEventListener("pagehide", () => post({ t: "bye" }));
  }
  const room = {
    presence: async p => { myPresence = p; post({ t: "hello", peer: { by: me.by, kind: me.kind, presence: p } }); emitPeers(); },
    emit: async (type, data) => {
      post({ t: "msg", type, data, by: uid });
      (msgCbs.get(type) || []).forEach(cb => cb({ data, by: uid, isMe: true }));
    },
    onPeers: (cb, err) => { if (!chan) { err?.(new Error("no BroadcastChannel")); return () => {}; } peerCbs.add(cb); emitPeers(); return () => peerCbs.delete(cb); },
    onConnection: cb => { queueMicrotask(() => cb(!!chan)); return () => {}; },
    on: (type, cb) => { if (!msgCbs.has(type)) msgCbs.set(type, []); msgCbs.get(type).push(cb); return () => {}; }
  };

  const services = { db, user, room };
  window.claude = { use: async name => { if (services[name]) return services[name]; throw new Error(name + " is not available in the local demo"); } };

  /* ---------- demo bar: open a student tab / reset ---------- */
  const bar = document.getElementById("demoBar");
  if (bar) {
    const css = "color:#ffd84d;font:700 13px/1 Nunito,system-ui,sans-serif;text-decoration:underline;background:none;border:0;cursor:pointer;padding:4px;white-space:nowrap";
    const a = document.createElement("a");
    a.style.cssText = css;
    if (isStudent) { a.href = location.pathname; a.textContent = "Opettajaksi ↗"; a.title = "Avaa opettajan näkymä uuteen välilehteen"; }
    else { a.href = location.pathname + "?opiskelija"; a.textContent = "Avaa opiskelijana ↗"; a.title = "Avaa uusi opiskelija toiseen välilehteen – välilehdet näkevät toisensa reaaliajassa"; }
    a.target = "_blank"; a.rel = "noopener";
    bar.appendChild(a);
    if (!isStudent) {
      const r = document.createElement("button");
      r.type = "button"; r.style.cssText = css.replace("#ffd84d", "#bdb6aa"); r.textContent = "Tyhjennä demo";
      r.title = "Poistaa kaikki tässä selaimessa tallennetut demotiedot";
      r.onclick = () => {
        if (!confirm("Poistetaanko kaikki tämän selaimen demotiedot (opintojaksot, materiaalit, viestit)?")) return;
        try { Object.keys(localStorage).filter(k => k.startsWith("origo.")).forEach(k => localStorage.removeItem(k)); } catch {}
        location.reload();
      };
      bar.appendChild(r);
    }
  }
})();
