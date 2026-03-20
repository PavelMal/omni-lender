#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  local result="$2"
  if [ "$result" = "0" ]; then
    echo "  [PASS] $label"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label"
    FAIL=$((FAIL + 1))
  fi
}

warn() {
  local label="$1"
  echo "  [WARN] $label"
  WARN=$((WARN + 1))
}

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== Quality Gate Check ==="
echo ""

# Check required docs exist
echo "--- Documentation ---"
for doc in HYPOTHESIS.md SCOPE.md ARCHITECTURE.md TASKS.yaml; do
  if [ -f "docs/$doc" ]; then
    check "$doc exists" 0
  else
    check "$doc exists" 1
  fi
done

# Check no secrets in code
echo ""
echo "--- Security ---"
if grep -rqn "PRIVATE_KEY\s*=\s*['\"]" --include="*.ts" --include="*.js" --include="*.sol" . 2>/dev/null; then
  check "No hardcoded secrets" 1
else
  check "No hardcoded secrets" 0
fi

if [ -f ".env" ] && grep -q ".env" .gitignore 2>/dev/null; then
  check ".env is gitignored" 0
elif [ ! -f ".env" ]; then
  check ".env is gitignored (no .env file)" 0
else
  check ".env is gitignored" 1
fi

# Check git status
echo ""
echo "--- Repository ---"
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  check "Git repository initialized" 0
else
  check "Git repository initialized" 1
fi

# Contracts: build + tests
echo ""
echo "--- Contracts ---"
if [ -f "contracts/foundry.toml" ]; then
  if forge build --root contracts > /dev/null 2>&1; then
    check "Contracts compile" 0
  else
    check "Contracts compile" 1
  fi

  FORGE_OUTPUT=$(forge test --root contracts 2>&1)
  if echo "$FORGE_OUTPUT" | grep -q "0 failed"; then
    TESTS_PASSED=$(echo "$FORGE_OUTPUT" | grep -o '[0-9]* tests passed' | head -1)
    check "Contract tests pass ($TESTS_PASSED)" 0
  else
    check "Contract tests pass" 1
  fi
else
  warn "No contracts directory with foundry.toml found"
fi

# Frontend: build + lint + tests
echo ""
echo "--- Frontend ---"
if [ -f "frontend/package.json" ]; then
  cd frontend

  if npx next build > /dev/null 2>&1; then
    check "Frontend builds" 0
  else
    check "Frontend builds" 1
  fi

  if npx next lint 2>&1 | grep -q "No ESLint warnings or errors"; then
    check "Linter passes (0 errors)" 0
  else
    check "Linter passes" 1
  fi

  if [ -f "jest.config.ts" ] || [ -f "jest.config.js" ]; then
    TEST_OUTPUT=$(npx jest 2>&1)
    if echo "$TEST_OUTPUT" | grep -q "Tests:.*failed"; then
      check "Frontend tests pass" 1
    elif echo "$TEST_OUTPUT" | grep -q "Tests:"; then
      TESTS_SUMMARY=$(echo "$TEST_OUTPUT" | grep "Tests:" | head -1)
      check "Frontend tests pass ($TESTS_SUMMARY)" 0
    else
      check "Frontend tests pass" 1
    fi
  else
    warn "No Jest config found — no frontend tests to run"
  fi

  cd "$PROJECT_ROOT"
else
  if [ -f "package.json" ]; then
    if npm run build > /dev/null 2>&1; then
      check "Project builds" 0
    else
      check "Project builds" 1
    fi
    if npm test > /dev/null 2>&1; then
      check "Tests pass" 0
    else
      check "Tests pass" 1
    fi
  else
    warn "No package.json found"
  fi
fi

# Summary
echo ""
echo "=== Summary ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Warnings: $WARN"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "Quality gate: FAILED"
  exit 1
else
  echo "Quality gate: PASSED"
  exit 0
fi
