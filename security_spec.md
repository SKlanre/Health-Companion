# Community Security Specification

## Data Invariants
- A community member must be either the creator or have an accepted join request (for private) or have joined (for public).
- Only community members can read messages and videos in a community.
- Only admins (creators) can approve/decline join requests.
- Messages sender ID must match authenticated user ID.
- Videos can only be uploaded by members (or admins specifically, prompt says "people who create this groups or challenges can upload videos", so I'll restrict to admins).
- Private communities are not visible to non-members in detail (only metadata like name/description/type).

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a community as another user.
2. **Access Bypass**: Non-member attempting to read messages in a private community.
3. **Privilege Escalation**: Member attempting to approve their own join request.
4. **Unauthorized Deletion**: Non-creator attempting to delete a community.
5. **ID Poisoning**: Creating a community with a massive junk string ID.
6. **State Shortcutting**: Updating a join request status from 'pending' to 'accepted' as a normal user.
7. **Resource Poisoning**: Uploading a video with a 1MB title string.
8. **Message Impersonation**: Sending a message in a community with a different `senderId`.
9. **Private Feed Leak**: Querying videos of a private community without being a member.
10. **Shadow Member**: Manually adding oneself to the `members` subcollection of a private group.
11. **Spam Flood**: Sending 100 messages in 1 second (handled by rate limiting/rules).
12. **Metadata Tampering**: Changing the `creatorId` of a community after creation.

## Test Runner (firestore.rules.test.ts)

```typescript
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "fitai-companion",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });
});

test("Non-member cannot read private community messages", async () => {
  const alice = testEnv.authenticatedContext("alice");
  const bob = testEnv.authenticatedContext("bob");
  
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "communities/comm1"), { isPrivate: true, creatorId: "alice" });
    await setDoc(doc(db, "communities/comm1/messages/msg1"), { text: "secret", senderId: "alice" });
  });

  const bobDb = bob.firestore();
  await assertFails(getDoc(doc(bobDb, "communities/comm1/messages/msg1")));
});

test("Only creator can approve join requests", async () => {
  const alice = testEnv.authenticatedContext("alice");
  const bob = testEnv.authenticatedContext("bob");
  const charlie = testEnv.authenticatedContext("charlie");

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "communities/comm1"), { isPrivate: true, creatorId: "alice" });
    await setDoc(doc(db, "communities/comm1/joinRequests/bob"), { userId: "bob", status: "pending" });
  });

  const charlieDb = charlie.firestore();
  await assertFails(updateDoc(doc(charlieDb, "communities/comm1/joinRequests/bob"), { status: "accepted" }));
});
```
