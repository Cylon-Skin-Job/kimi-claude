# Pre-Existing Playwright Test Failures

Captured 2026-03-04 on branch `feature/chunk-rendering`.
These failures existed before the dropdown code block work began.

---

## 1. Think block shimmer test — timing failure

**Test:** `orb-timing.spec.ts:29` — "think block renders with shimmer then content"

**What it does:**
- Sends "Explain your reasoning" via chat input
- Waits for a `text=Thinking` label to appear within 3000ms

**Failure:**
```
Error: expect(locator).toBeVisible() failed
Locator: locator('text=Thinking')
Expected: visible
Timeout: 3000ms
Error: element(s) not found
```

**Root cause:** The test sends a real prompt to the backend and expects a think block to appear within 3 seconds. The CollapsibleBlock staggered reveal delays the "Thinking" label by 800ms after icon fade-in, but that only starts once the backend actually sends `ContentPart` with `type: "think"`. If the backend doesn't respond with a thinking token within ~2200ms, the label never appears in time.

**Likely fix options:**
- Increase timeout to 8000ms+ to account for backend latency
- Use `/demo` command instead of a real prompt (demo has deterministic think content)
- Mock the WebSocket to inject a think token immediately

---

## 2. Code block progressive typing — chunk rendering broken

**Test:** `typing-effect.spec.ts:87` — "code block types characters progressively"

**What it does:**
- Sends `/demo` command
- Waits for `pre code` element to appear
- Samples `textContent.length` 50 times at 30ms intervals
- Expects at least 4 unique non-zero lengths (proving characters appear progressively)

**Failure:**
```
Expected: > 3
Received: 1
```

Only 1 unique length was observed — the code block content appeared all at once instead of typing character-by-character.

**Root cause:** The WIP chunk-based rendering on this branch (`f6655d8`) broke the code block typing animation. The commit message itself says "broken typing animation." The CodeBlock component's chase loop may be completing instantly because the block arrives pre-complete from the `/demo` command, bypassing the gradual token stream that the typing loop depends on.

**Likely fix options:**
- Fix the CodeBlock typing loop to handle pre-complete blocks (type through existing content even if `complete` is already true)
- Ensure `/demo` command delivers code content incrementally rather than all at once
- This is likely the same issue the `feature/chunk-rendering` branch is working to resolve
