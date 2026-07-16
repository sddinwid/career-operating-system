# Prompt 09 - Today Screen and Workflow Rules

Implement calculated workflow recommendations.

## Requirements

- Today sections: due today, overdue, interviews soon, needs contact, ready for outreach, waiting/follow-up, stale applications
- Calculate last touch, days open, days since last touch, next action, due date, outreach stage, and ready-today state
- Default configurable rules for first outreach, follow-up intervals, stale threshold, and interview-prep lead time
- User may dismiss or override a recommendation without rewriting source activities
- Add settings for workflow intervals
- Explain why each recommendation appears

## Acceptance criteria

- Calculations are deterministic and unit tested
- Rejection and withdrawn statuses stop outreach recommendations
- New activities update recommendations
- Today screen performs acceptably with imported data
