# instagram

Verified 2026-09-27, logged out. `site2api verify instagram` passes, and both ops were called
from a clean `SITE2API_HOME` using only this bundled spec: tier 1, no cookies, no browser. No
account is needed.

| op | args | returns | tier |
|---|---|---|---|
| `getProfile` | `username` (example `nasa`) | `pk`, `username`, `full_name`, `biography`, `follower_count`, `following_count`, `is_verified`, `is_private`, `profile_pic_url`, `bio_links` | 1 (GET of the profile page, about 400 ms) |
| `getPosts` | `username` (example `nasa`) | the 12 most recent posts: `node.code` (shortcode, so the post is `instagram.com/p/<code>/`), `node.caption.text`, `node.accessibility_caption`, `node.media_type`, `node.product_type`, `node.display_uri` | 1 (the same GET, about 500 to 1000 ms) |

```sh
site2api call instagram getProfile username=spacex
site2api call instagram getPosts username=natgeo
```

## How it works

A logged-out hard load of `https://www.instagram.com/<username>/` server-renders the Relay
preloads for `PolarisLoggedOutDesktopWWWProfileRootContentQuery` (profile) and
`...ProfilePostsTabContentQuery` (first 12 posts) as JSON in `<script data-sjs>` tags. Both ops
send that GET and use `response.format: "embedded"`, with a regex that anchors on
`"xig_user_by_username":{"pk":"<digits>","username"` (profile) or
`...,"polaris_ordered_timeline_connection"` (posts). The regexes were set by hand
(`add --embedded '<regex>'` does this now). There is no doc_id or other rotating id in the request, so a rescan
has nothing to heal. If Instagram changes the embedded shape, a call returns `drift`, and the
fix is to update the regex.

## Known limits

- Profile and posts come in two separate script chunks, and an op extracts one JSON value, so
  they are two ops. Getting both costs two page GETs.
- Logged out, you get only the first 12 posts. There is no pagination, and posts have no
  timestamp or like and comment counts.
- Post fields are flat dotted keys (`"node.code"`). `pick` can rename them now
  (`code=node.code`); the bundled spec keeps the dotted keys.
- A username that doesn't exist returns a page without the data. site2api replays the example
  username, which still answers, and returns `input` in about 1.5 s, with no heal and no browser.
- `profile_pic_url` and `display_uri` are signed CDN URLs that expire (`oe=` parameter).
- Only verified logged out, from a US IP. Heavy use may bring up Instagram's login wall.
  Tier 1 would then return `auth` ("login page instead of content").
