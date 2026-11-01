No account is needed. Results are in Russian.

- `city` is the slug in a Yandex Weather address (`yandex.ru/pogoda/ru/<slug>`): `moscow`,
  `saint-petersburg`, `kazan`, `novosibirsk`, `yekaterinburg`. An unknown slug answers
  `class: "input"` (404).
- `summary` is the page's own one-sentence report (condition, temperature, feels-like, wind,
  pressure, humidity, water temperature, sunrise and sunset). Its sunrise and sunset times can be
  swapped or shown in another time zone: don't rely on them.
- In `hourlyForecast`, `time` is the city's local time label (`"14:00"`; the first item after
  midnight reads `"пн, 00:00"`). Items with an odd minute (`"16:51"`) mark sunrise or sunset.
  `description` adds the condition, feels-like and precipitation chance.
- The 10-day forecast is not covered. Yandex web search and Yandex Market are not covered either.

## Maintainer notes

Verified on 2026-10-31 (US Pacific; 2026-11-01 UTC), logged out, from a US network, with an isolated
`API_ANYTHING_HOME` and no imported cookies.

- Yandex web search (`yandex.ru/search/?text=`) redirected the capture browser to
  `yandex.ru/showcaptcha` (SmartCaptcha) on the first load. Yandex Market search answered plain HTTP
  once, but the capture browser got SmartCaptcha, so it can't be learned. Not attempted further: no
  CAPTCHA solving. Yandex Weather served both Chrome and plain HTTP with no challenge.
- Both ops read the server-rendered `https://yandex.ru/pogoda/ru/{city}` with HTML recipes. The page
  is Next.js with hashed class names (`AppFact_condition__dCl7J`), so selectors match the stable
  prefix with `[class*="AppFact_condition"]`. Examples `moscow` and `saint-petersburg`.
- The 10-day forecast (`AppShortForecastDay`, `AppForecastDay`) is in the HTML but inside a
  streamed `<div hidden>` that the page's script reveals; api-anything drops hidden elements, so it
  reads nothing there.
- The hourly `<time datetime>` attribute converts the city's local label as if it were Moscow time,
  so it is wrong outside UTC+3 (Novosibirsk "12:00" was given as 09:00Z). The op returns the label
  instead.
- Unseen calls at tier 1: `getWeather city=kazan`, `hourlyForecast city=novosibirsk` (39 items).
  `verify yandex` passed 3/3 at tier 1 (both examples and the 404 check), also in a second empty
  home given only the exported spec.
- Client-hint headers that change per machine (`rtt`, `downlink`, `ect`, `device-memory`) were
  removed from the requests by hand; verify passed after the edit.
