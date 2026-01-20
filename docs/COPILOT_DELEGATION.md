# Copilot Delegation

## What is Copilot Delegation?

**Copilot delegation** is a development pattern where a general-purpose AI coding assistant (like GitHub Copilot) delegates specialized tasks to **custom agents**—focused AI experts with domain-specific knowledge, tools, and constraints.

Think of it as a senior engineer (the general Copilot) managing a team of specialized engineers (custom agents), where each specialist has deep expertise in one area.

## Core Concept

```
┌─────────────────────────────────────────────────────────┐
│              General Copilot (Manager)                  │
│  • Understands full repository context                  │
│  • Routes tasks to appropriate specialists              │
│  • Validates overall integration                        │
└────────────┬────────────────────────────────────────────┘
             │
             ├─► Custom Agent: chronicle-evidence-engineer
             │   └─ Expertise: Forensic evidence, receipts
             │
             ├─► Custom Agent: protocol-engineer (future)
             │   └─ Expertise: WebSocket protocol changes
             │
             └─► Custom Agent: anticheat-engineer (future)
                 └─ Expertise: Detection patterns, Tem logic
```

## Why Delegation Matters for Akalynth

Akalynth has **strict architectural constraints** that are easy to violate accidentally:

### 1. **Receipt-First Architecture**
- ❌ Bad: Add a feature, then add receipts as afterthought
- ✅ Good: Custom agent ensures receipts are designed first, code follows

### 2. **Server Authority**
- ❌ Bad: Client sends coordinates, server validates
- ✅ Good: Custom agent enforces intent-only pattern

### 3. **Civil Guarantees (G1-G15)**
- ❌ Bad: Introduce RNG that's not reproducible
- ✅ Good: Custom agent blocks non-deterministic changes

### 4. **Anti-Cheat Vigilance**
- ❌ Bad: Add movement feature that bypasses speed checks
- ✅ Good: Custom agent validates against detector patterns

## How It Works

### Traditional Approach (No Delegation)
```
User: "Add item drop evidence for players"
     ↓
Copilot: *writes code directly*
     ↓
Result: May violate receipts-first, forget audit trail, 
        or introduce client-authoritative pattern
```

### With Delegation
```
User: "Add item drop evidence for players"
     ↓
Copilot: *recognizes this is Phase 4.4 Chronicle Evidence*
     ↓
Copilot: *delegates to chronicle-evidence-engineer agent*
     ↓
Custom Agent:
  - Validates against Civil Guarantees
  - Ensures receipt-driven design
  - Uses existing explainDeathDrops() function
  - Adds proper ownership validation
  - Creates read-only WS endpoint
     ↓
Result: Architecturally sound implementation
```

## Akalynth's Custom Agent System

### Directory Structure

```
.claude/
├── agents/
│   └── chronicle-evidence-engineer.md  # Phase 4.4 specialist
├── commands/
│   ├── anticheat.md       # Quick anticheat review
│   ├── atomic.md          # Commit discipline check
│   ├── bootstrap.md       # Environment setup
│   ├── protocol.md        # Protocol validation
│   └── verify.md          # MVP verification
└── settings.json          # Permissions, hooks, plugins
```

### Custom Agent Anatomy

Each agent is a markdown file with:

1. **Frontmatter** - Name, description, model selection
2. **Role Statement** - What the agent does
3. **Hard Constraints** - Non-negotiable rules
4. **Scope** - What's in/out of scope
5. **Operating Principles** - How to approach tasks
6. **Project Context** - Akalynth-specific knowledge

Example from `chronicle-evidence-engineer.md`:

```markdown
---
name: chronicle-evidence-engineer
description: "Use this agent when working on Phase 4.4..."
model: opus
---

You are the Chronicle Evidence Engineer for Akalynth.

Hard constraints (non-negotiable):
1. Receipts are canonical. SQLite is a projection only.
2. You may NOT introduce new gameplay rules, randomness, or state mutation.
3. All explanations must be reproducible from:
   - receipt_hash
   - drop-policy inputs
   - deterministic functions already present in code.
```

## When to Use Delegation

### ✅ Use Custom Agents For:

1. **Architecture-Critical Changes**
   - Protocol modifications
   - Receipt schema additions
   - Anti-cheat detector patterns

2. **Domain-Specific Features**
   - Chronicle evidence (use `chronicle-evidence-engineer`)
   - Tem challenge logic (future `anticheat-engineer`)
   - World state updates (future `world-engineer`)

3. **Compliance Enforcement**
   - Civil Guarantees validation
   - Audit trail completeness
   - Deterministic behavior verification

### ❌ Don't Need Delegation For:

1. **Simple Fixes**
   - Typos, formatting
   - Adding comments
   - Updating dependencies

2. **Documentation Only**
   - README updates
   - Comment improvements
   - Doc structure changes

3. **Tooling**
   - Scripts that don't touch game logic
   - Build configuration
   - CI/CD setup

## Benefits for Akalynth

### 1. **Constraint Enforcement**
Custom agents act as **guardrails** for complex architectural rules:

```typescript
// WITHOUT AGENT: Easy to forget
function handleMove(x: number, y: number) {
  player.position = {x, y};  // ❌ Client-authoritative!
}

// WITH AGENT: Enforces intent-only pattern
function handleMoveIntent(direction: Direction) {
  // Validate intent
  // Server computes new position
  // Emit receipt
  // Broadcast result
}
```

### 2. **Knowledge Preservation**
Agents capture tribal knowledge that's scattered across:
- `docs/ARCHITECTURE.md`
- `docs/PROTOCOL.md`
- `docs/ANTICHEAT.md`
- `CLAUDE.md`
- Comments in code

### 3. **Consistency**
Same task → same approach, every time:
- Always emit receipts in JSONL format
- Always validate ownership before exposing data
- Always check tiles are walkable before movement

### 4. **Reduced Review Burden**
Pull requests from custom agents need less scrutiny because constraints are pre-validated.

### 5. **Faster Onboarding**
New contributors can rely on agents to teach them patterns:
- "Use anticheat agent to add detection signal"
- Agent guides them through proper pattern

## Creating Custom Agents for Akalynth

### Step 1: Identify the Domain

Good agent candidates:
- **Protocol Engineer** - WebSocket message types, client/server contract
- **Anticheat Engineer** - Detector patterns, Tem challenges, heat scoring
- **World Engineer** - Map data, movement validation, spawn points
- **Persistence Engineer** - Receipt-driven SQLite, materialization
- **Audit Engineer** - JSONL format, public receipt redaction

### Step 2: Define Hard Constraints

From Akalynth's architecture:
```markdown
Hard constraints (non-negotiable):
1. Server is authoritative. Client sends intent only.
2. Every player action emits a JSONL receipt.
3. Movement must validate: walkable tile, speed limit, direction.
4. Anti-cheat checks run before applying intent.
5. No RNG without deterministic seed from receipt_hash.
```

### Step 3: Specify Scope

```markdown
Scope:
- Movement validation logic
- Tile walkability checks
- Speed limit enforcement
- Direction validation

Out of scope:
- Combat mechanics (separate agent)
- Inventory system (separate agent)
- Chat (separate agent)
```

### Step 4: Add Operating Principles

```markdown
Operating principles:
- Check tile walkability before updating position
- Always emit move_intent receipt before move_result
- Broadcast to nearby players only (within view range)
- Reject impossible moves with clear error messages
```

### Step 5: Provide Project Context

```markdown
Project context:
- Movement logic: apps/server/src/world/movement.ts
- World state: apps/server/src/world/state.ts
- Map data: packages/shared/maps/*.json
- Protocol: packages/shared/protocol.ts (move_intent, move_result)
```

### Template

```markdown
---
name: [agent-name]
description: "Use this agent when working on [feature area]..."
model: opus  # or sonnet for faster/cheaper tasks
---

You are the [Role] for Akalynth.

Your role:
- [Primary responsibility]
- [Secondary responsibility]

Hard constraints (non-negotiable):
1. [Architectural rule from ARCHITECTURE.md]
2. [Protocol rule from PROTOCOL.md]
3. [Anti-cheat rule from ANTICHEAT.md]

Scope:
- [Feature area 1]
- [Feature area 2]

Explicitly out of scope:
- [Other feature areas]
- [Changes requiring different agent]

Operating principles:
- [How to approach tasks]
- [Key validation steps]

Project context:
- [Relevant file paths]
- [Key functions to reuse]
- [Protocol message types]

If asked to do anything outside this scope, respond with:
"Refused — violates [constraint]: [reason]."
```

## Practical Examples

### Example 1: Adding Anti-Cheat Signal

**Without delegation:**
```typescript
// Developer adds signal but forgets heat calculation
if (perfectCadence) {
  console.log("Suspicious pattern detected");
}
```

**With anticheat-engineer agent:**
```typescript
// Agent ensures proper pattern:
// 1. Detect pattern
// 2. Update heat score
// 3. Emit receipt
// 4. Check threshold
// 5. Issue Tem if needed
if (perfectCadence) {
  heat += HEAT_PERFECT_CADENCE;
  emitReceipt("heat_signal", {pattern: "perfect_cadence"});
  if (heat >= TEM_THRESHOLD) {
    issueTemChallenge();
  }
}
```

### Example 2: Protocol Change

**Without delegation:**
```typescript
// Developer adds field without documenting
interface MoveResult {
  x: number;
  y: number;
  newField: string;  // ❌ Not in PROTOCOL.md
}
```

**With protocol-engineer agent:**
```typescript
// Agent ensures:
// 1. Update docs/PROTOCOL.md
// 2. Update packages/shared/protocol.ts
// 3. Add server handler
// 4. Add client handler
// 5. Add receipt type
// 6. Update verification scenario
```

### Example 3: Evidence Feature (Real Agent)

**Task:** "Show players why their item dropped on death"

**Delegation flow:**
```
Copilot recognizes: Phase 4.4 Chronicle Evidence
    ↓
Delegates to: chronicle-evidence-engineer
    ↓
Agent implements:
  ✅ Read-only WS endpoint (get_evidence)
  ✅ Validates player ownership
  ✅ Reuses explainDeathDrops()
  ✅ Anchors to chronicle_event_id
  ✅ Returns structured evidence
  ✅ Preserves Civil Guarantees
```

## Integration with CLAUDE.md

The main `CLAUDE.md` file provides general guidance for **all** tasks. Custom agents are **specialists** that operate within those guidelines but add domain-specific knowledge.

### Division of Responsibility

**CLAUDE.md** (General Guidelines):
- Project overview
- Build/test commands
- File structure
- Commit discipline
- MVP scope

**Custom Agents** (Domain Specialists):
- Specific feature constraints
- Domain-specific patterns
- Technical decision rationale
- Code organization for that domain

### Example Flow

```
User: "Add Tem challenge for chat spam"
    ↓
CLAUDE.md: Provides context about Tem system, anticheat pipeline
    ↓
Copilot: Recognizes this is anticheat work
    ↓
Custom Agent (anticheat-engineer): Implements with proper:
  - Heat scoring
  - Threshold checks
  - Challenge issuance
  - Receipt emission
  - Audit trail
```

## Commands vs Agents

### Commands (`.claude/commands/*.md`)

**Purpose:** Quick validations, one-off checks

**Examples:**
- `anticheat.md` - Review anticheat logic
- `atomic.md` - Check commit atomicity
- `verify.md` - Run MVP verification

**When to use:** Quick checks during development

### Agents (`.claude/agents/*.md`)

**Purpose:** Full implementation with domain expertise

**Examples:**
- `chronicle-evidence-engineer` - Implement evidence features

**When to use:** Building features, refactoring domains

## Best Practices

### 1. **Delegate Early**
```
❌ Try yourself first, call agent if stuck
✅ Recognize domain, delegate immediately
```

### 2. **Trust the Agent**
```
❌ Agent implements → You rewrite → Lose constraints
✅ Agent implements → You review → Trust expertise
```

### 3. **Scope Agents Narrowly**
```
❌ "world-and-combat-and-inventory-engineer"
✅ "world-engineer", "combat-engineer", "inventory-engineer"
```

### 4. **Update Agents with Learnings**
```
When you discover a new constraint or pattern:
→ Update the relevant agent's hard constraints
→ Prevents future violations
```

### 5. **Use Commands for Validation**
```
Before PR:
→ Run verification: @verify
→ Check anticheat: @anticheat
→ Validate protocol: @protocol
```

## Future Agent Opportunities

Based on Akalynth's architecture, consider creating:

### Protocol Engineer
- WebSocket message validation
- Client/server contract enforcement
- Protocol documentation sync

### Anticheat Engineer
- Detection pattern implementation
- Heat scoring logic
- Tem challenge design

### World Engineer
- Map data validation
- Movement logic
- Spawn point management

### Persistence Engineer
- Receipt-driven materialization
- SQLite projection validation
- Query optimization

### Audit Engineer
- JSONL format validation
- Public receipt redaction
- Evidence chain integrity

## Measuring Success

A good custom agent:

1. **Catches violations** before code review
2. **Teaches patterns** to developers
3. **Maintains consistency** across features
4. **Reduces bugs** from architectural misunderstandings
5. **Speeds up** experienced developers (less decision fatigue)

## Anti-Patterns to Avoid

### 1. Over-Delegation
```
❌ Create agent for every tiny feature
✅ Create agents for architectural domains
```

### 2. Under-Specified Agents
```
❌ "You are the engineer. Do engineering."
✅ "You enforce receipts-first. Reject non-deterministic RNG."
```

### 3. Overlapping Agents
```
❌ Two agents both handle movement logic
✅ Clear boundaries: world-engineer = logic, protocol-engineer = messages
```

### 4. Ignoring Agent Refusals
```
❌ Agent refuses → Ask general Copilot instead
✅ Agent refuses → Understand why → Fix approach
```

## Conclusion

Copilot delegation is Akalynth's **force multiplier** for maintaining architectural integrity at scale. By encoding domain expertise into custom agents, the project ensures that:

- Complex constraints are enforced automatically
- New contributors learn patterns through guided implementation
- Code reviews focus on business logic, not architectural correctness
- Tribal knowledge is preserved and accessible

As the project grows, custom agents become increasingly valuable—they're living documentation that **actively participates** in development rather than passively sitting in `/docs`.

## Further Reading

- `CLAUDE.md` - General development guidance
- `docs/ARCHITECTURE.md` - System architecture
- `docs/PROTOCOL.md` - WebSocket protocol
- `docs/ANTICHEAT.md` - Anti-cheat system
- `.claude/agents/chronicle-evidence-engineer.md` - Example custom agent
