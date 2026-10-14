import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("pull_release", Path(__file__).with_name("pull-release.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
COMMIT = "a" * 40
REGISTRY = "registry.digitalocean.com/example-registry"
MANIFEST = {"schema": 2, "repository": release.REPOSITORY, "commit": COMMIT,
            "images": {name: f"{name}@sha256:{'b' * 64}" for name in release.VARIABLES}}


def fixture():
    checks = [{"id": index, "name": name, "head_sha": COMMIT, "app": {"id": 15368},
               "status": "completed", "conclusion": "success"} for index, name in enumerate(release.CHECKS)]
    checks.append({"id": 10, "name": "Production image manifest", "head_sha": COMMIT,
                   "app": {"id": 15368}, "status": "completed", "conclusion": "success",
                   "external_id": "100:2", "output": {"summary": json.dumps(MANIFEST)}})
    return {
        "git/ref/heads/main": {"object": {"sha": COMMIT}},
        f"commits/{COMMIT}/check-runs?per_page=100&filter=all": {"check_runs": checks},
        "actions/runs/100/attempts/2": {"head_sha": COMMIT, "head_branch": "main", "event": "push",
                                      "head_repository": {"full_name": release.REPOSITORY},
                                      "repository": {"full_name": release.REPOSITORY},
                                      "path": ".github/workflows/production-images.yml",
                                      "status": "completed", "conclusion": "success"},
    }


class SourceTests(unittest.TestCase):
    def test_exact_successful_main_publisher(self):
        selected = release.candidate(fixture().__getitem__)
        self.assertEqual(selected, {"manifest": MANIFEST, "run": "100:2"})

    def test_failed_latest_check_and_unfinished_run_do_not_deploy(self):
        data = fixture()
        data[f"commits/{COMMIT}/check-runs?per_page=100&filter=all"]["check_runs"].append({
            "id": 20, "name": release.CHECKS[0], "head_sha": COMMIT,
            "app": {"id": 15368}, "status": "completed", "conclusion": "failure"})
        self.assertIsNone(release.candidate(data.__getitem__))
        data = fixture()
        data["actions/runs/100/attempts/2"]["status"] = "in_progress"
        self.assertIsNone(release.candidate(data.__getitem__))

    def test_pr_fork_wrong_workflow_and_commit_are_refused(self):
        for key, value in [("event", "pull_request"), ("head_branch", "dev"),
                           ("path", ".github/workflows/ci.yml"), ("head_sha", "c" * 40),
                           ("head_repository", {"full_name": "attacker/fork"})]:
            data = fixture()
            data["actions/runs/100/attempts/2"][key] = value
            with self.assertRaises(RuntimeError):
                release.candidate(data.__getitem__)

    def test_manifest_cannot_inject_tags_paths_or_private_registry(self):
        for value in ["ui:latest", "ui@sha256:bad", f"{REGISTRY}/ui@sha256:{'b' * 64}",
                      f"worker@sha256:{'b' * 64}", f"ui@sha256:{'b' * 64}\nextra"]:
            data = fixture()
            manifest = copy.deepcopy(MANIFEST)
            manifest["images"]["ui"] = value
            data[f"commits/{COMMIT}/check-runs?per_page=100&filter=all"]["check_runs"][-1]["output"]["summary"] = json.dumps(manifest)
            with self.assertRaises(RuntimeError):
                release.candidate(data.__getitem__)

    def test_data_changes_divergence_and_truncation_require_acceptance(self):
        self.assertFalse(release.needs_acceptance({"status": "ahead", "files": [{"filename": "apps/ui/src/components/about/Globe.tsx"}]}))
        for name in ["apps/strapi/src/index.ts", "pnpm-lock.yaml", "apps/ui/src/lib/auth.ts",
                     "apps/ui/src/lib/billing/database.ts", "packages/shared-data/index.ts"]:
            self.assertTrue(release.needs_acceptance({"status": "ahead", "files": [{"filename": name}]}))
            self.assertTrue(release.needs_acceptance({"status": "ahead", "files": [{"filename": "moved.ts", "previous_filename": name}]}))
        for comparison in [{"status": "diverged"}, {"status": "ahead", "files": []},
                           {"status": "ahead", "files": [{"filename": "safe.ts"}] * 300}]:
            self.assertTrue(release.needs_acceptance(comparison))


class PromotionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.previous = "CMS_IMAGE=old-cms\nUI_IMAGE=old-ui\nWORKER_IMAGE=old-worker\n"
        (self.root / "release.env").write_text(self.previous)
        (self.root / "ui.production.env").write_text("BETA_GATE_ENABLED=true\nBILLING_ENV=sandbox\n")
        self.config = {"root": str(self.root), "registry": REGISTRY, "docker_config": str(self.root), "smoke": []}
        self.selected = {"manifest": MANIFEST, "run": "100:2"}
        self.commands = []

    def tearDown(self):
        self.temporary.cleanup()

    def run_command(self, args, _root, _docker_config):
        self.commands.append(args)
        if args[1:3] == ["image", "inspect"]:
            return json.dumps([{"Architecture": "amd64", "Config": {"User": "node", "Labels": {"org.opencontainers.image.revision": COMMIT}}}])
        return ""

    def test_success_pins_digests_records_source_and_preserves_runtime(self):
        before = release.runtime_hashes(self.root)
        release.promote(self.config, self.selected, fixture().__getitem__, self.run_command,
                        lambda _: None, lambda *_: None)
        record = json.loads((self.root / "automated-release.json").read_text())
        self.assertEqual(record["commit"], COMMIT)
        self.assertEqual(record["smoke"], "passed")
        self.assertEqual(release.runtime_hashes(self.root), before)
        self.assertEqual((self.root / f"release-{COMMIT}/previous-runtime/release.env").read_text(), self.previous)
        self.assertIn(f"UI_IMAGE={REGISTRY}/{MANIFEST['images']['ui']}", (self.root / "release.env").read_text())
        self.assertEqual((self.root / "release.env").stat().st_mode & 0o777, 0o600)

    def test_failed_smoke_restores_previous_images_and_does_not_record_success(self):
        probes = []

        def failing_smoke(_):
            probes.append(1)
            if len(probes) == 1:
                raise RuntimeError("HTTP failure")

        with self.assertRaises(release.PromotionFailed):
            release.promote(self.config, self.selected, fixture().__getitem__, self.run_command,
                            failing_smoke, lambda *_: None)
        self.assertEqual(len(probes), 2)
        self.assertEqual((self.root / "release.env").read_text(), self.previous)
        self.assertFalse((self.root / "automated-release.json").exists())
        starts = [command for command in self.commands if "up" in command]
        self.assertEqual(len(starts), 2)

    def test_newer_main_or_failed_pull_leaves_current_release_untouched(self):
        data = fixture()
        data["git/ref/heads/main"]["object"]["sha"] = "c" * 40
        with self.assertRaises(KeyError):
            release.promote(self.config, self.selected, data.__getitem__, self.run_command)
        self.assertEqual((self.root / "release.env").read_text(), self.previous)

        def failed_pull(*_):
            raise RuntimeError("Registry unavailable")

        with self.assertRaises(RuntimeError):
            release.promote(self.config, self.selected, fixture().__getitem__, failed_pull)
        self.assertEqual((self.root / "release.env").read_text(), self.previous)


if __name__ == "__main__":
    unittest.main()
