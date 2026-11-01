No account is needed.

- Counts (`followers`, `likes`, `plays`, ...) are exact numbers as strings (`"2151317"`).
  `createTime` is seconds since the epoch (a string in `getVideo`, a number in `getProfile`).
- There is no op for a profile's video list: TikTok loads it through signed requests. Get a
  video id from a video link (`tiktok.com/@<username>/video/<videoId>`).
- `getVideo` is keyed by `videoId`; TikTok ignores the `username` in the URL. `author` is the real
  handle, so check it when the video should be someone's.
- A username that doesn't exist comes back `auth` ("login page instead of content"), because
  TikTok's not-found page carries a login form. Check the spelling before asking anyone to log in.
- `avatar` and `cover` are signed CDN URLs that expire (`x-expires`).
- `hashtags` lists the video's challenge tags and can be empty when the caption has none.

## Maintainer notes

Verified 2026-10-31, logged out, from a US IP. `api-anything verify tiktok` passed both examples at
tier 1.

| op | learned with | unseen call | tier |
|---|---|---|---|
| `getProfile` | `nasa`, `natgeo` | `nba`: 27.4M followers, 25,030 videos | 1 (~0.7 s) |
| `getVideo` | `nasa/7679483952507276558`, `natgeo/6971524320732515590` | `natgeo/7241639542766259499` | 1 (~1.2 s) |

Both ops GET the server-rendered page and read the JSON in
`<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">`: `__DEFAULT_SCOPE__["webapp.user-detail"].userInfo`
for a profile, `__DEFAULT_SCOPE__["webapp.video-detail"].itemInfo.itemStruct` for a video. Counts
come from `statsV2` (exact strings); `stats` holds rounded numbers. No cookie, msToken or X-Bogus
signature is needed for the document; the JSON APIs the page calls afterwards (`/api/post/item_list`,
`/api/repost/item_list`) carry those signatures and were not learned.

For an unknown username the page has `webapp.user-detail` with `statusCode: 10221` and no
`userInfo`; the classifier finds a login form on that page and answers `auth` before the
example replay that would give `input`. No check records this, since `auth` would make `verify`
inconclusive. Not tried: a private account, an age-restricted or removed video, a non-US IP
(the CDN hosts in results were `tiktokcdn-us.com`).
