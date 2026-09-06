"""Keep pytest out of a file that is not a pytest suite.

`contracts/test_helpers.py` matches pytest's default `test_*.py` discovery
pattern, but it is a standalone script: it runs every check at import and calls
sys.exit() at the end. Collected by pytest that produces an INTERNALERROR with a
stack trace and "no tests collected", on a repository whose README promises a
suite that runs on a fresh clone. Nothing in that output distinguishes a broken
contract from a file pytest should never have opened.

Anybody who reviews GenLayer contracts has pytest and genlayer-test installed,
so `pytest` is a plausible first command for a reader who has not been told
otherwise. It now finds the real suite in tests/ and leaves the script alone.

Run the contract checks directly instead - or through `npm test`, which runs
all three suites:

    python contracts/test_helpers.py
"""

collect_ignore = ["contracts/test_helpers.py"]
