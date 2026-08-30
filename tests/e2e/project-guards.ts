import { test, type TestInfo } from "@playwright/test";

/**
 * Skips the current test unless it is running under the xs-mobile project
 * (375×812). Use for:
 *  - exact 375×812 screenshots
 *  - bottom-nav clearance assertions
 *  - strict mobile density checks whose limits are only valid at xs
 */
export function skipUnlessXsMobile(testInfo: TestInfo): void {
  test.skip(
    testInfo.project.name !== "xs-mobile",
    "xs-mobile only: strict 375×812 density / bottom-nav clearance / exact screenshot",
  );
}

/**
 * Skips the current test unless it is running under a mobile project
 * (xs-mobile or sm-large-mobile). Use for:
 *  - functional login / OAuth2 flows
 *  - portfolio / session functional tests
 *  - UX-states that use the mobile bottom-nav (nav-transactions, mobile-menu-btn)
 */
export function skipUnlessMobile(testInfo: TestInfo): void {
  test.skip(
    !["xs-mobile", "sm-large-mobile"].includes(testInfo.project.name),
    "mobile projects only (xs-mobile, sm-large-mobile): functional flows using mobile nav / UI",
  );
}

/**
 * Skips the current test unless it is running under a desktop project
 * (lg-small-desktop or xl-desktop). Use for:
 *  - desktop-table assertions
 *  - sidebar / desktop-nav specific checks
 */
export function skipUnlessDesktop(testInfo: TestInfo): void {
  test.skip(
    !["lg-small-desktop", "xl-desktop"].includes(testInfo.project.name),
    "desktop projects only (lg-small-desktop, xl-desktop)",
  );
}

/**
 * No-op guard — all five projects run this test. Use for:
 *  - per-breakpoint visual regression screenshots (snapshot name includes project name)
 *  - cross-breakpoint layout assertions (overflow, card heights, touch targets)
 *  - settings responsive density suite
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function skipUnlessResponsive(_testInfo: TestInfo): void {
  // Intentionally empty: this guard exists for documentation — it signals that
  // the test is verified at all five configured viewports.
}
