# Rookguard Stranger Return Pilot v1

**Current system:** The Gate Remembers stranger cohort
**Primary tension:** measure voluntary return without turning reminders,
compensation, synthetic accounts, reconnect noise, or operator coaching into a
false retention signal.

**Status:** READY FOR A FROZEN DEPLOYED BUILD — NOT RUN
**Implementation authority:** none beyond read-only receipt analysis and
consented observation
**Deployment / recruitment:** separately authorized

## Design Goal

Determine whether one fixed Rookguard build causes genuine newcomers to return
without being asked. This is a directional product test, not a general
retention claim.

## Cohort

- 12 people with no prior Akalynth play and no project collaboration.
- Fixed compensation may cover the first observation session only.
- No compensation, reminder, scheduled appointment, or social pressure for
  returning.
- One cohort label maps to one opaque account id in a private consented roster.
- Emails, handles, and direct identifiers stay out of the analysis artifact.

## First Session

Give exactly one instruction:

> Create a character and play for up to 30 minutes. Stop whenever you want.

Do not name objectives, receipts, Chronicle, marks, Tem, canal, vocation, gate,
or return. Help only when a verified technical defect prevents entry, and log
that intervention.

Observe:

- first thing noticed;
- first accepted action;
- first confusion or help request;
- whether the canal is discovered without prompting;
- Tem failure and recovery;
- training-yard wait or abandonment;
- oath choice language;
- gate completion;
- what the player does after the last explicit instruction;
- exact unsolicited positive and negative quotes.

## Frozen-Build Evidence

Before the first player:

1. Record the deployed commit from `/v1/health`.
2. Prove it equals the approved build commit.
3. Run the account portal and Rookguard live-path preflight.
4. Verify and hash the pre-cohort canonical receipt chain.
5. Freeze gameplay policy and UI for the cohort window.

Suspend recruitment if any of those checks fail.

## Return Window

After the first session:

- do not contact the participant for seven days;
- provide no return reward;
- the initial handoff may say once: “If you ever choose to play again, use this
  same account-page link.” This prevents an expired play token from silently
  creating a guest identity and is not a return reminder.

### Qualified voluntary return

A participant qualifies only when all are true:

1. A cohort-owned character emits another successful `enter_world`.
2. It occurs at least 24 hours and no more than seven days after first entry.
3. At least three accepted gameplay receipts follow.
4. Those accepted receipts span at least five minutes.
5. No reminder, scheduled session, operator intervention, or return
   compensation occurred.

Reconnects, duplicate delivery, synthetic smoke accounts, operator accounts,
and guest fallbacks do not qualify.

## Evidence Sources

- Canonical private receipt JSONL: primary truth.
- Character-created / selected receipts: private account-to-character custody.
- Human observation notes and exact quotes: comprehension and emotion.
- Runtime build commit and verified chain hashes: cohort integrity.

Chronicle rows, account-session `last_seen_at`, and automated smoke sessions are
supporting evidence only. They are not the return denominator.

## Metrics

### Primary

```text
qualified voluntary returns / eligible newcomers
```

### Secondary

- account creation to successful world entry;
- 20-minute continuation;
- six-mark completion;
- time to first stall;
- unaided canal discovery and cast;
- unsolicited optional-action rate;
- post-gate continuation;
- return-session accepted-action span;
- intervention and technical-exclusion count.

## Decision Bands

For this 12-person directional pilot:

| Qualified returns | Decision |
| --- | --- |
| 0–1 | The adventure is not yet earning return. Repair the dominant stall. |
| 2–3 | Pull is weak or ambiguous. Make one bounded correction and repeat. |
| 4+ | Meaningful directional signal. Run a second independent cohort. |

No band establishes population retention, market fit, or launch readiness.

## Failure and Recovery

| Contamination | Treatment |
| --- | --- |
| Account/email/play entry fails | Suspend intake; exclude only with evidence |
| Runtime commit changes | Stop cohort; do not combine builds |
| Receipt chain fails verification | Stop analysis and preserve custody |
| Service outage interrupts a player | Extend that player's window; do not score as rejection |
| Old `/play/` tab falls back to guest | Record measurement loss; reconcile only through authorized account evidence |
| Observer coaches | Mark session contaminated; do not count as clean |
| Participant returns because reminded | Report separately; not qualified |

## Kill-Switches

- Stop recruitment.
- Freeze or discard a contaminated cohort.
- Extend only outage-affected windows.
- Revert the build for safety without recomputing settled evidence.
- Withhold all retention language if chain, build, consent, or cohort custody is
  incomplete.

## Success Condition

The pilot succeeds as an experiment when its cohort, build, chain, exclusions,
interventions, and result are reconstructable. The game succeeds only if real
strangers voluntarily return.
