# Myers Diff Linear Space

```typescript
import diff from '@monyone/myers-diff-linear-space';

diff([1, 2, 3], [3, 2, 3]);
// [ { type: 'delete', from: 0 }, { type: 'insert', to: 0 } ]

```