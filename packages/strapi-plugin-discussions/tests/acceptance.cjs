/* eslint-disable unicorn/no-process-exit -- This standalone CLI must terminate Strapi background handles after acceptance. */
const assert = require("node:assert/strict")
const cp = require("node:child_process")
const crypto = require("node:crypto")
const fs = require("node:fs")
const { createRequire } = require("node:module")
const os = require("node:os")
const path = require("node:path")

const appModules = process.env.DISCUSSIONS_ACCEPTANCE_MODULES
if (!appModules)
  throw new Error(
    "Set DISCUSSIONS_ACCEPTANCE_MODULES to an independent Strapi host node_modules directory"
  )
const peerRequire = createRequire(path.join(appModules, "../package.json"))
const connectionFile = process.env.DISCUSSIONS_ACCEPTANCE_CONNECTION_FILE
if (!connectionFile)
  throw new Error(
    "Set DISCUSSIONS_ACCEPTANCE_CONNECTION_FILE to a private JSON PostgreSQL connection file"
  )
const baseConnection = JSON.parse(fs.readFileSync(connectionFile, "utf8"))
const artifact = process.env.DISCUSSIONS_ACCEPTANCE_TARBALL
if (!artifact)
  throw new Error(
    "Set DISCUSSIONS_ACCEPTANCE_TARBALL to the packed plugin path"
  )
function write(dir, file, data) {
  const target = path.join(dir, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(
    target,
    typeof data === "string" ? data : JSON.stringify(data)
  )
}
function prepare(mode, database) {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), `discussions-independent-${mode}-`)
  )
  write(dir, "package.json", {
    name: `independent-${mode}-host`,
    version: "1.0.0",
    private: true,
    dependencies: {
      react: "^18.0.0",
      "react-dom": "^18.0.0",
      "react-router-dom": "^6.0.0",
      "styled-components": "^6.0.0",
      "@strapi/strapi": "5.57.0",
      "@strapi/plugin-users-permissions": "5.57.0",
      "strapi-plugin-discussions": "0.1.0",
    },
  })
  fs.mkdirSync(path.join(dir, "node_modules/@strapi"), { recursive: true })
  for (const pkg of ["strapi", "plugin-users-permissions"])
    fs.symlinkSync(
      path.join(appModules, "@strapi", pkg),
      path.join(dir, "node_modules/@strapi", pkg)
    )
  for (const pkg of [
    "pg",
    "react",
    "react-dom",
    "react-router-dom",
    "styled-components",
  ])
    fs.symlinkSync(
      path.join(appModules, pkg),
      path.join(dir, "node_modules", pkg)
    )
  fs.mkdirSync(path.join(dir, "node_modules/strapi-plugin-discussions"))
  cp.execFileSync("/usr/bin/tar", [
    "-xzf",
    artifact,
    "--strip-components=1",
    "-C",
    path.join(dir, "node_modules/strapi-plugin-discussions"),
  ])
  write(
    dir,
    "config/server.js",
    `module.exports={host:'127.0.0.1',port:0,app:{keys:['${crypto.randomBytes(24).toString("hex")}']},cron:{enabled:false}}`
  )
  write(
    dir,
    "config/admin.js",
    `module.exports={auth:{secret:'${crypto.randomBytes(24).toString("hex")}'},apiToken:{salt:'${crypto.randomBytes(24).toString("hex")}'},transfer:{token:{salt:'${crypto.randomBytes(24).toString("hex")}'}}}`
  )
  write(
    dir,
    "config/database.js",
    `module.exports={connection:{client:'postgres',connection:{...JSON.parse(require('node:fs').readFileSync(${JSON.stringify(connectionFile)},'utf8')),database:'${database}'},pool:{min:0,max:10}},settings:{forceMigration:true,runMigrations:true}}`
  )
  write(
    dir,
    "config/middlewares.js",
    `module.exports=['strapi::logger','strapi::errors','strapi::security','strapi::cors','strapi::poweredBy','strapi::query','strapi::body','strapi::session','strapi::favicon','strapi::public']`
  )
  let custom =
    mode === "custom"
      ? `identity:async(ctx,{strapi})=>{const p=await strapi.plugin('users-permissions').service('jwt').getToken(ctx);if(!p?.id)return null;const u=await strapi.db.query('plugin::users-permissions.user').findOne({where:{id:p.id},populate:['role']});if(!u||u.blocked||!u.confirmed)return null;return {key:'custom:'+u.id,name:u.username,capabilities:['read','createThread','reply','editOwn','report','subscribe',...(u.role.type==='discussions-moderator'?['moderate']:[])]}},publicAuthor:async(key,{strapi})=>{if(!/^custom:[0-9]+$/.test(key))return {name:'Community member'};const u=await strapi.db.query('plugin::users-permissions.user').findOne({where:{id:Number(key.split(':')[1])}});return {name:!u||u.blocked?'Community member':u.username}},`
      : ""
  write(
    dir,
    "config/plugins.js",
    `module.exports={discussions:{enabled:true,resolve:'./node_modules/strapi-plugin-discussions',config:{${custom}moderatorRoleIds:[],targets:{'api::article.article':async(target,{strapi})=>{const a=await strapi.documents('api::article.article').findOne({documentId:target.documentId,status:'published',fields:['title','slug']});return a?{title:a.title,url:'/articles/'+encodeURIComponent(a.slug)}:null}}}},'users-permissions':{config:{jwtSecret:'${crypto.randomBytes(24).toString("hex")}'}}}`
  )
  write(dir, "src/index.js", "module.exports={register(){},bootstrap(){}}")
  write(dir, "src/api/article/content-types/article/schema.json", {
    kind: "collectionType",
    collectionName: "articles",
    info: {
      singularName: "article",
      pluralName: "articles",
      displayName: "Article",
    },
    options: { draftAndPublish: true },
    attributes: {
      title: { type: "string", required: true },
      slug: { type: "string", required: true },
    },
  })
  fs.mkdirSync(path.join(dir, "public/uploads"), { recursive: true })

  return dir
}
async function host(mode, dir) {
  process.chdir(dir)
  process.env.NODE_ENV = "production"
  process.env.STRAPI_TELEMETRY_DISABLED = "true"
  const hostRequire = createRequire(path.join(dir, "package.json"))
  const { createStrapi } = hostRequire("@strapi/strapi")
  if (
    mode === "users-permissions" &&
    process.env.DISCUSSIONS_ACCEPTANCE_ADMIN_BUILD === "1"
  ) {
    const executable = path.join(
      path.dirname(hostRequire.resolve("@strapi/strapi/package.json")),
      "bin/strapi.js"
    )
    const build = cp.spawnSync(process.execPath, [executable, "build"], {
      cwd: dir,
      encoding: "utf8",
      timeout: 180000,
    })
    process.stdout.write(build.stdout || "")
    process.stderr.write(build.stderr || "")
    if (build.status !== 0)
      throw new Error("Independent packed-plugin admin build failed")
  }
  const strapi = await createStrapi({
    appDir: dir,
    distDir: dir,
    autoReload: false,
    serveAdminPanel: false,
  }).load()
  try {
    await strapi.server.listen()
    const port = strapi.server.httpServer.address().port
    const base = `http://127.0.0.1:${port}`
    const moderatorRole = await strapi.db
      .query("plugin::users-permissions.role")
      .create({
        data: {
          name: "Discussion moderator",
          description: "Test moderator",
          type: "discussions-moderator",
        },
      })
    const memberRole = await strapi.db
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "authenticated" } })
    strapi.config
      .get("plugin::discussions")
      .moderatorRoleIds.push(moderatorRole.id)
    const member = await strapi.db
      .query("plugin::users-permissions.user")
      .create({
        data: {
          username: "Writer",
          email: "writer@example.invalid",
          password: crypto.randomBytes(16).toString("hex"),
          confirmed: true,
          blocked: false,
          provider: "local",
          role: memberRole.id,
        },
      })
    const mod = await strapi.db.query("plugin::users-permissions.user").create({
      data: {
        username: "Moderator",
        email: "moderator@example.invalid",
        password: crypto.randomBytes(16).toString("hex"),
        confirmed: true,
        blocked: false,
        provider: "local",
        role: moderatorRole.id,
      },
    })
    const jwt = strapi.plugin("users-permissions").service("jwt")
    const memberToken = jwt.issue({ id: member.id }),
      moderatorToken = jwt.issue({ id: mod.id })
    let httpRequests = 0
    const request = async (method, url, token, body) => {
      httpRequests += 1
      const response = await fetch(base + url, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          "content-type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      const data = await response.json()

      return { status: response.status, data }
    }
    const service = strapi.plugin("discussions").service("discussion")
    const subject = await service.saveSubject(
      { key: "admin:acceptance", name: "Test administrator", admin: true },
      {
        name: "Open discussion",
        slug: "open",
        description: "",
        languages: ["en", "es"],
        visibility: "public",
        createPolicy: "members",
      }
    )
    assert.equal(
      (await request("POST", "/api/discussions/threads", null, {})).status,
      401
    )
    assert.equal((await request("GET", "/discussions/revisions")).status, 401)
    const created = await request(
      "POST",
      "/api/discussions/threads",
      memberToken,
      {
        subjectId: subject.documentId,
        title: "Portable thread",
        body: "First text",
        language: "en",
        authorKey: "forged",
      }
    )
    assert.equal(created.status, 200, JSON.stringify(created.data))
    const thread = created.data.thread,
      revision = created.data.revision
    const ownPending = await request(
      "GET",
      `/api/discussions/my/records?recordId=${thread.id}&limit=1`,
      memberToken
    )
    assert.equal(ownPending.data.data[0].pendingRevision.body, "First text")
    assert.equal(
      (await request("GET", `/api/discussions/threads/${thread.id}`)).status,
      404
    )
    const review = await request(
      "PUT",
      `/api/discussions/moderation/revisions/${revision.id}`,
      moderatorToken,
      { decision: "approve", baseVersion: 0 }
    )
    assert.equal(review.status, 200, JSON.stringify(review.data))
    assert.equal(
      (await request("GET", `/api/discussions/threads/${thread.id}`)).data.body,
      "First text"
    )
    const reply = await request(
      "POST",
      `/api/discussions/threads/${thread.id}/replies`,
      memberToken,
      { body: "Pending reply" }
    )
    assert.equal(reply.status, 200, JSON.stringify(reply.data))
    await request(
      "PUT",
      `/api/discussions/moderation/revisions/${reply.data.revision.id}`,
      moderatorToken,
      { decision: "approve", baseVersion: 0 }
    )
    assert.equal(
      (await request("GET", `/api/discussions/threads/${thread.id}/replies`))
        .data.data.length,
      1
    )
    const first = await request(
      "POST",
      `/api/discussions/records/thread/${thread.id}/revisions`,
      memberToken,
      { body: "First edit", baseVersion: 1 }
    )
    const second = await request(
      "POST",
      `/api/discussions/records/thread/${thread.id}/revisions`,
      memberToken,
      { body: "Second edit", baseVersion: 1 }
    )
    assert.equal(first.status, 200, JSON.stringify(first.data))
    assert.equal(second.status, 200, JSON.stringify(second.data))
    const competing = await Promise.all(
      [first, second].map((edit) =>
        request(
          "PUT",
          `/api/discussions/moderation/revisions/${edit.data.id}`,
          moderatorToken,
          { decision: "approve", baseVersion: 1 }
        )
      )
    )
    assert.deepEqual(
      competing.map((response) => response.status).sort(),
      [200, 409]
    )
    const report = await request(
      "POST",
      `/api/discussions/records/thread/${thread.id}/reports`,
      memberToken,
      { reason: "Review this version" }
    )
    assert.equal(report.status, 200)
    const nextEdit = await request(
      "POST",
      `/api/discussions/records/thread/${thread.id}/revisions`,
      memberToken,
      { body: "Corrected after report", baseVersion: 2 }
    )
    assert.equal(nextEdit.status, 200)
    assert.equal(
      (
        await request(
          "PUT",
          `/api/discussions/moderation/revisions/${nextEdit.data.id}`,
          moderatorToken,
          { decision: "approve", baseVersion: 2 }
        )
      ).status,
      200
    )
    assert.equal(
      (
        await request(
          "PUT",
          `/api/discussions/moderation/reports/${report.data.id}`,
          moderatorToken,
          { decision: "remove", baseVersion: 0, recordBaseVersion: 2 }
        )
      ).status,
      409
    )
    const reports = await request(
      "GET",
      "/api/discussions/moderation/reports",
      moderatorToken
    )
    assert.equal(reports.data.data[0].recordVersion, 2)
    assert.equal(reports.data.data[0].currentVersion, 3)
    assert.equal(
      (
        await request(
          "PUT",
          `/api/discussions/moderation/reports/${report.data.id}`,
          moderatorToken,
          { decision: "dismiss", baseVersion: 0 }
        )
      ).status,
      200
    )
    const indexes = await strapi.db.connection.raw(
      "SELECT indexname FROM pg_indexes WHERE tablename LIKE 'discussions_%'"
    )
    assert(
      indexes.rows.some(
        (row) => row.indexname === "discussions_thread_subject_state_activity"
      ),
      "thread lookup index missing"
    )
    const article = await strapi.documents("api::article.article").create({
      data: { title: "Published source", slug: "source" },
      status: "published",
    })
    const attached = await request(
      "POST",
      "/api/discussions/threads",
      memberToken,
      {
        subjectId: subject.documentId,
        title: "Attached",
        body: "Source discussion",
        language: "en",
        target: { uid: "api::article.article", documentId: article.documentId },
      }
    )
    assert.equal(attached.status, 200, JSON.stringify(attached.data))
    await request(
      "PUT",
      `/api/discussions/moderation/revisions/${attached.data.revision.id}`,
      moderatorToken,
      { decision: "approve", baseVersion: 0 }
    )
    assert.equal(
      (
        await request(
          "GET",
          `/api/discussions/threads/${attached.data.thread.id}`
        )
      ).data.target.url,
      "/articles/source"
    )
    await strapi
      .documents("api::article.article")
      .unpublish({ documentId: article.documentId })
    assert.equal(
      (
        await request(
          "GET",
          `/api/discussions/threads/${attached.data.thread.id}`
        )
      ).status,
      404
    )
    await strapi.db
      .query("plugin::users-permissions.user")
      .update({ where: { id: member.id }, data: { blocked: true } })
    assert.equal(
      (
        await request(
          "POST",
          `/api/discussions/threads/${thread.id}/replies`,
          memberToken,
          { body: "Denied after revocation" }
        )
      ).status,
      401
    )
    if (mode === "custom") {
      assert.equal(
        (await request("GET", `/api/discussions/threads/${thread.id}`)).data
          .author.name,
        "Community member"
      )
      assert.equal(
        (
          await request(
            "GET",
            `/api/discussions/threads/${thread.id}`,
            moderatorToken
          )
        ).data.author.name,
        "Community member"
      )
    }
    await strapi.db
      .query("plugin::users-permissions.user")
      .update({ where: { id: member.id }, data: { blocked: false } })
    const erasureProposal = await request(
      "POST",
      `/api/discussions/threads/${thread.id}/replies`,
      memberToken,
      { body: "Private erasure proposal" }
    )
    assert.equal(erasureProposal.status, 200)
    const actorKey = `${mode === "custom" ? "custom" : "up"}:${member.id}`
    const erasureRace = await Promise.all([
      request(
        "PUT",
        `/api/discussions/moderation/revisions/${erasureProposal.data.revision.id}`,
        moderatorToken,
        { decision: "approve", baseVersion: 0 }
      ),
      service.eraseActor(actorKey),
    ])
    assert(
      [200, 404, 409].includes(erasureRace[0].status),
      "Unexpected review/erasure race status"
    )
    const erasedPublic = await request(
      "GET",
      `/api/discussions/threads/${thread.id}`
    )
    assert.equal(erasedPublic.status, 200)
    assert.equal(erasedPublic.data.body, "Corrected after report")
    assert.equal(
      erasedPublic.data.author.name,
      mode === "custom" ? "Community member" : "Former member"
    )
    assert.equal(
      (
        await request(
          "POST",
          `/api/discussions/threads/${thread.id}/replies`,
          memberToken,
          { body: "Stale session authority" }
        )
      ).status,
      401
    )
    assert.equal((await service.eraseActor(actorKey)).alreadyErased, true)
    assert.equal(
      await strapi.db
        .query("plugin::discussions.revision")
        .count({ where: { authorKey: actorKey } }),
      0
    )
    assert.equal(
      await strapi.db
        .query("plugin::discussions.audit-event")
        .count({ where: { actorKey } }),
      0
    )
    const tableNames = await strapi.db.connection.raw(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'discussions_%'"
    )
    console.log(
      JSON.stringify({
        mode,
        accepted: true,
        httpRequests,
        concurrentApprovalStatuses: competing
          .map((response) => response.status)
          .sort(),
        pluginTables: tableNames.rows.length,
        indexes: indexes.rows.length,
      })
    )
  } finally {
    await strapi.destroy()
  }
}
async function main() {
  if (process.argv[2] === "host") {
    await host(process.argv[3], process.argv[4])

    return
  }
  const { Client } = peerRequire("pg")
  const admin = new Client(baseConnection)
  await admin.connect()
  const created = []
  try {
    for (const mode of ["users-permissions", "custom"]) {
      const database = `discussions_${mode.replaceAll("-", "_")}_${process.pid}`
      await admin.query(`CREATE DATABASE "${database}"`)
      created.push(database)
      const dir = prepare(mode, database)
      const result = cp.spawnSync(
        process.execPath,
        [__filename, "host", mode, dir],
        { encoding: "utf8", timeout: 180000 }
      )
      process.stdout.write(result.stdout || "")
      process.stderr.write(result.stderr || "")
      if (result.status !== 0)
        throw new Error(`Independent ${mode} host failed (${result.status})`)
      fs.rmSync(dir, { recursive: true, force: true })
    }
  } finally {
    for (const database of created) {
      await admin.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
        [database]
      )
      await admin.query(`DROP DATABASE "${database}"`)
    }
    await admin.end()
  }
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.stack)
    process.exit(1)
  })
