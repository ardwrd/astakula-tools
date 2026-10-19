(() => {
  "use strict";

  const form = document.getElementById("repoForm");
  const input = document.getElementById("repoInput");
  const button = document.getElementById("inspectButton");
  const status = document.getElementById("statusMessage");
  const result = document.getElementById("resultContent");
  const metrics = document.getElementById("repoMetrics");
  const topics = document.getElementById("repoTopics");

  function parseRepository(value) {
    let text = String(value || "").trim();
    if (!text) throw new Error("Masukkan nama repository, contoh: owner/repository.");
    if (/^https?:\/\//i.test(text)) {
      let url;
      try { url = new URL(text); } catch { throw new Error("URL GitHub tidak valid."); }
      if (url.protocol !== "https:" || !["github.com", "www.github.com"].includes(url.hostname) ||
          url.port || url.username || url.password || url.search || url.hash) {
        throw new Error("Gunakan URL repository publik https://github.com/owner/repository.");
      }
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length !== 2) throw new Error("URL harus mengarah ke halaman utama sebuah repository.");
      text = segments.join("/");
    }
    const parts = text.split("/");
    if (parts.length !== 2) throw new Error("Gunakan format owner/repository.");
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(owner) ||
        !/^[a-zA-Z0-9._-]{1,100}$/.test(repo) || repo === "." || repo === "..") {
      throw new Error("Nama owner atau repository tidak valid.");
    }
    return { owner, repo };
  }

  function setStatus(message, type) {
    status.textContent = message;
    status.className = "inspector-status" + (type ? " is-" + type : "");
  }

  function addMetric(label, value) {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    item.append(term, description);
    metrics.append(item);
  }

  function displayRepository(data, owner, repo) {
    const repositoryUrl = "https://github.com/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo);
    document.getElementById("repoName").textContent = data.full_name || owner + "/" + repo;
    document.getElementById("repoDescription").textContent = data.description || "Repository ini belum memiliki deskripsi.";
    metrics.replaceChildren();
    topics.replaceChildren();

    const count = (value) => new Intl.NumberFormat("id-ID").format(Number(value) || 0);
    const date = (iso) => {
      if (!iso) return "Tidak tersedia";
      const parsed = new Date(iso);
      return Number.isNaN(parsed.getTime()) ? "Tidak tersedia" :
        new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
    };
    addMetric("Stars", count(data.stargazers_count));
    addMetric("Forks", count(data.forks_count));
    addMetric("Open issues (termasuk PR)", count(data.open_issues_count));
    addMetric("Bahasa utama", data.language || "Tidak tersedia");
    addMetric("Lisensi", (data.license && (data.license.spdx_id || data.license.name)) || "Tidak tercantum");
    addMetric("Default branch", data.default_branch || "Tidak tersedia");
    addMetric("Push terakhir (UTC)", date(data.pushed_at));
    addMetric("Visibilitas", data.visibility || "public");

    for (const label of Array.isArray(data.topics) ? data.topics.slice(0, 12) : []) {
      if (typeof label !== "string") continue;
      const tag = document.createElement("span");
      tag.textContent = label;
      topics.append(tag);
    }
    document.getElementById("repoLink").href = repositoryUrl;
    document.getElementById("issuesLink").href = repositoryUrl + "/issues";
    document.getElementById("pullsLink").href = repositoryUrl + "/pulls";
    result.hidden = false;
    setStatus("Berhasil mengambil metadata repository publik dari GitHub API.", "success");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    result.hidden = true;
    let parsed;
    try {
      parsed = parseRepository(input.value);
    } catch (error) {
      setStatus(error.message, "error");
      input.focus();
      return;
    }
    button.disabled = true;
    setStatus("Mengambil metadata publik dari GitHub...");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const endpoint = "https://api.github.com/repos/" + encodeURIComponent(parsed.owner) + "/" + encodeURIComponent(parsed.repo);
      const response = await fetch(endpoint, {
        headers: { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        signal: controller.signal
      });
      if (!response.ok) {
        if (response.status === 404) throw new Error("Repository tidak ditemukan atau tidak dapat diakses secara publik.");
        if (response.status === 403 || response.status === 429) {
          throw new Error("GitHub membatasi permintaan API saat ini. Coba lagi nanti (akses publik tanpa token memiliki rate limit).");
        }
        throw new Error("GitHub API mengembalikan HTTP " + response.status + ". Coba lagi nanti.");
      }
      const data = await response.json();
      if (!data || !data.full_name) throw new Error("Data repository dari GitHub tidak lengkap.");
      displayRepository(data, data.owner && data.owner.login || parsed.owner, data.name || parsed.repo);
      const share = new URL(window.location.href);
      share.searchParams.set("repo", data.full_name);
      window.history.replaceState(null, "", share);
    } catch (error) {
      setStatus(error.name === "AbortError" ? "Permintaan terlalu lama. Coba lagi." :
        error instanceof TypeError ? "Jaringan bermasalah. Periksa koneksi dan coba lagi." : error.message, "error");
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
    }
  });

  const preset = new URLSearchParams(window.location.search).get("repo");
  if (preset && preset.length <= 250) {
    input.value = preset;
    form.requestSubmit();
  }
})();
