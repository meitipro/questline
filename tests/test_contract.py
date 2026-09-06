"""A pytest entry point for the contract checks.

    pytest -q

Anybody reviewing a GenLayer contract has pytest installed, so `pytest` is a
plausible first command. Without this it answered "no tests ran" on a
repository whose README promises a suite - which reads as though there isn't
one.

The checks themselves live in `contracts/test_helpers.py`, which is a
standalone script rather than a pytest module: it runs on plain Python with a
stubbed genlayer and no GenVM, which is what lets the whole suite pass on a
fresh clone with no `npm install` and no network. That property is worth more
than pytest-native structure, so this shells out to it rather than importing it.

Running it as a SUBPROCESS is deliberate twice over. It keeps the stubbed
genlayer module out of the pytest process, where a globally installed
genlayer-test plugin has already loaded the real one; and it means the script
stays runnable on its own, which is how npm test and the parity suite call it.
"""

import pathlib
import subprocess
import sys

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "contracts" / "test_helpers.py"


def test_contract_checks_pass():
    """Every deterministic rule the contract enforces, in one subprocess."""
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        capture_output=True,
        text=True,
        # The script prints a tick on success, and the cp1252 stdout a child
        # process inherits on Windows dies on it - which would fail the test on
        # the success character.
        env={"PYTHONIOENCODING": "utf-8", "PATH": ""},
        cwd=str(SCRIPT.parent.parent),
    )
    output = (result.stdout or "") + (result.stderr or "")
    assert result.returncode == 0, output
    # A script that printed nothing and exited 0 would pass the line above.
    assert "passed, 0 failed" in output, output
    print(output.strip().splitlines()[-1])
