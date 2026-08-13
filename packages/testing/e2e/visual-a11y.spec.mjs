import { expect, test } from "@playwright/test";

import {
  assertNoSecretSurface,
  commitPlan,
  createDirectSession,
  createReview,
  createTask,
  createTimeBlock,
  ids,
  newStageContext,
  observePage,
} from "./helpers.mjs";

test.describe.configure({ mode: "serial" });

test("22-shot responsive Light/Dark matrix establishes reviewed Fact/Proposal/Snapshot baselines", async ({ browser }) => {
  const loginContext = await newStageContext(browser, { viewport: { width: 1440, height: 900 } });
  const login = await loginContext.newPage();
  const loginObserved = observePage(login);
  await login.goto("/login");
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await login.setViewportSize(viewport);
    for (const theme of ["light", "dark"]) {
      await setTheme(login, theme);
      await assertGeometry(login, viewport);
      await expect(login).toHaveScreenshot(`responsive/login-${viewport.width}x${viewport.height}-${theme}.png`, screenshotOptions);
    }
  }
  loginObserved.assertClean(expect);
  await loginContext.close();

  const context = await newStageContext(browser, { viewport: { width: 1440, height: 900 } });
  const session = await createDirectSession(context, "stage8-visual");
  await prepareVisualFixture(session);
  const today = await context.newPage();
  const todayObserved = observePage(today);
  await today.goto("/app/today");
  await expect(today.getByText("实时已连接")).toBeVisible();
  await expect(today.getByText("Stage 8 视觉重点一", { exact: true }).first()).toBeVisible();
  await today.getByRole("textbox", { name: "把此刻的内容留在 Inbox" }).fill("Stage 8 可审阅 Proposal");
  await today.getByRole("button", { name: "保存 Capture" }).click();
  await expect(today.getByRole("heading", { name: "Stage 8 可审阅 Proposal" })).toBeVisible({ timeout: 15_000 });
  await expect(today.getByText("Snapshot · baseline")).toBeVisible();
  await expect(today.getByText("Proposal", { exact: true })).toBeVisible();
  await expect(today.getByText("Fact intake", { exact: true })).toBeVisible();

  const todayViewports = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ];
  for (const viewport of todayViewports) {
    await today.setViewportSize(viewport);
    for (const theme of ["light", "dark"]) {
      await setTheme(today, theme);
      await assertGeometry(today, viewport);
      await assertOntologyContrast(today);
      await expect(today).toHaveScreenshot(
        `responsive/today-${viewport.width}x${viewport.height}-${theme}.png`,
        { ...screenshotOptions, fullPage: true },
      );
    }
  }

  const review = await context.newPage();
  const reviewObserved = observePage(review);
  await review.goto("/app/review");
  await expect(review.getByRole("heading", { name: "计划" })).toBeVisible();
  await expect(review.getByRole("heading", { name: "实际" })).toBeVisible();
  const reviewViewports = [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ];
  for (const viewport of reviewViewports) {
    await review.setViewportSize(viewport);
    for (const theme of ["light", "dark"]) {
      await setTheme(review, theme);
      await assertGeometry(review, viewport);
      await assertOntologyContrast(review);
      await expect(review).toHaveScreenshot(
        `responsive/review-${viewport.width}x${viewport.height}-${theme}.png`,
        { ...screenshotOptions, fullPage: true },
      );
    }
  }
  await assertNoSecretSurface(today, expect);
  await assertNoSecretSurface(review, expect);
  todayObserved.assertClean(expect);
  reviewObserved.assertClean(expect);
  await context.close();
});

test("keyboard focus, roles, names, headings and focus-visible remain usable", async ({ browser }) => {
  const context = await newStageContext(browser, { viewport: { width: 390, height: 844 } });
  const session = await createDirectSession(context, "stage8-keyboard-a11y");
  await createTask(session, {
    id: "01989abc-0006-7000-8000-000000000601",
    title: "Keyboard focus Task",
    key: "stage8-keyboard-task",
  });
  const page = await context.newPage();
  const observed = observePage(page, { allowedConsole: [/404 \(Not Found\)/u] });
  await page.goto("/app/today");
  await expect(page.getByRole("navigation", { name: "Daily Loop" })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "今天" })).toBeVisible();
  await assertHeadingOrder(page);

  const firstTask = page.getByRole("checkbox", { name: /Keyboard focus Task/u });
  await firstTask.focus();
  await expect(firstTask).toBeFocused();
  await assertVisibleFocus(firstTask);
  await expect(page).toHaveScreenshot("focus/today-checkbox-mobile-light.png", screenshotOptions);
  await page.keyboard.press("Space");
  await expect(firstTask).toBeChecked();

  const spinbutton = page.getByRole("spinbutton", { name: "今日可用容量（分钟）" });
  await spinbutton.fill("59");
  await spinbutton.press("ArrowUp");
  await expect(spinbutton).toHaveValue("60");
  const quickCapture = page.getByRole("textbox", { name: "把此刻的内容留在 Inbox" });
  await quickCapture.focus();
  await assertVisibleFocus(quickCapture);
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "提交 baseline" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(spinbutton).toBeFocused();

  const reviewLink = page.getByRole("link", { name: "复盘" });
  await reviewLink.focus();
  await assertVisibleFocus(reviewLink);
  await page.evaluate(() => globalThis.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("focus/navigation-mobile-light.png", screenshotOptions);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "每日复盘" })).toBeVisible();
  await assertHeadingOrder(page);
  observed.assertClean(expect);
  await context.close();

  const loginContext = await newStageContext(browser, { viewport: { width: 390, height: 844 } });
  const login = await loginContext.newPage();
  const loginObserved = observePage(login);
  await login.goto("/login");
  await login.keyboard.press("Tab");
  const loginButton = login.getByRole("button", { name: "建立开发会话" });
  await expect(loginButton).toBeFocused();
  await assertVisibleFocus(loginButton);
  await expect(login).toHaveScreenshot("focus/login-button-mobile-light.png", screenshotOptions);
  await login.keyboard.press("Shift+Tab");
  await login.keyboard.press("Tab");
  await expect(loginButton).toBeFocused();
  loginObserved.assertClean(expect);
  await loginContext.close();

  const errorContext = await newStageContext(browser, { viewport: { width: 390, height: 844 } });
  const errorPage = await errorContext.newPage();
  await errorPage.goto("/app/today");
  await expect(errorPage.getByText("Task Facts 暂不可读")).toBeVisible();
  await assertOntologyContrast(errorPage);
  await errorContext.close();
});

test("reduced-motion preserves Login, Today, Quick Capture, Proposal and Review state", async ({ browser }) => {
  const loginContext = await newStageContext(browser, { reducedMotion: "reduce" });
  const login = await loginContext.newPage();
  await login.goto("/login");
  expect(await login.evaluate(() => globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  await expect(login.getByRole("button", { name: "建立开发会话" })).toBeVisible();
  await loginContext.close();

  const context = await newStageContext(browser, { reducedMotion: "reduce" });
  await createDirectSession(context, "stage8-visual");
  const today = await context.newPage();
  const observed = observePage(today);
  await today.goto("/app/today");
  expect(await today.evaluate(() => globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  await expect(today.getByText("Stage 8 视觉重点一", { exact: true }).first()).toBeVisible();
  await today.getByRole("textbox", { name: "把此刻的内容留在 Inbox" }).fill("Stage 8 reduced motion Proposal");
  await today.getByRole("button", { name: "保存 Capture" }).click();
  await expect(today.getByRole("heading", { name: "Stage 8 reduced motion Proposal" })).toBeVisible({ timeout: 15_000 });
  await today.getByRole("link", { name: "复盘" }).click();
  await expect(today.getByRole("heading", { name: "计划" })).toBeVisible();
  observed.assertClean(expect);
  await context.close();
});

async function prepareVisualFixture(session) {
  await createTask(session, {
    id: ids.visualTaskOne,
    title: "Stage 8 视觉重点一",
    key: "stage8-visual-task-one",
  });
  await createTask(session, {
    id: ids.visualTaskTwo,
    title: "Stage 8 视觉重点二",
    key: "stage8-visual-task-two",
  });
  await createTimeBlock(session, {
    id: ids.visualBlock,
    taskId: ids.visualTaskOne,
    key: "stage8-visual-block",
  });
  await commitPlan(session, {
    id: ids.visualPlan,
    taskIds: [ids.visualTaskOne, ids.visualTaskTwo],
    timeBlockIds: [ids.visualBlock],
    key: "stage8-visual-plan",
  });
  await createReview(session, {
    id: ids.visualReview,
    planId: ids.visualPlan,
    key: "stage8-visual-review",
  });
}

async function setTheme(page, theme) {
  await page.evaluate((value) => {
    globalThis.document.documentElement.dataset.theme = value;
  }, theme);
  await page.evaluate(() => new Promise((resolve) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))));
  await page.evaluate(() => globalThis.document.fonts.ready);
}

async function assertGeometry(page, viewport) {
  const geometry = await page.evaluate(() => {
    const root = globalThis.document.documentElement;
    const viewportWidth = root.clientWidth;
    const interactive = [...globalThis.document.querySelectorAll("a,button,input,textarea,select")]
      .filter((element) => {
        const style = globalThis.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      });
    return {
      clientWidth: viewportWidth,
      scrollWidth: root.scrollWidth,
      offscreenControls: interactive.filter(({ left, right, width }) => width > 0 && (left < -1 || right > viewportWidth + 1)),
    };
  });
  expect(geometry.clientWidth).toBe(viewport.width);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.offscreenControls).toEqual([]);
}

async function assertHeadingOrder(page) {
  const levels = await page.locator("h1,h2,h3,h4,h5,h6").evaluateAll((headings) => headings.map((heading) => Number(heading.tagName.slice(1))));
  expect(levels[0]).toBe(1);
  expect(levels.every((level, index) => index === 0 || level <= levels[index - 1] + 1)).toBe(true);
}

async function assertVisibleFocus(locator) {
  const focus = await locator.evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
  });
  expect(
    (focus.outlineStyle !== "none" && focus.outlineWidth !== "0px") || focus.boxShadow !== "none",
    `focused control must expose an outline or box shadow: ${JSON.stringify(focus)}`,
  ).toBe(true);
}

async function assertOntologyContrast(page) {
  const ratios = await page.locator([
    "body",
    ".ontology-label",
    "button",
    ".daily-page__header p",
    ".daily-shell__connection",
    ".shell__brand",
    ".state-message--error",
    ".xx-surface[data-tone=\"intelligence\"]",
  ].join(", ")).evaluateAll((elements) => {
    const parseColor = (value) => {
      const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/u.exec(value);
      if (match === null) return null;
      return {
        red: Number(match[1]),
        green: Number(match[2]),
        blue: Number(match[3]),
        alpha: match[4] === undefined ? 1 : Number(match[4]),
      };
    };
    const luminance = ({ red, green, blue }) => {
      const channels = [red, green, blue].map((value) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const contrastRatio = (element) => {
      const foreground = parseColor(globalThis.getComputedStyle(element).color);
      let current = element;
      let background = null;
      while (current !== null && background === null) {
        const parsed = parseColor(globalThis.getComputedStyle(current).backgroundColor);
        if (parsed !== null && parsed.alpha === 1) background = parsed;
        current = current.parentElement;
      }
      if (foreground === null || foreground.alpha !== 1 || background === null) return null;
      const light = Math.max(luminance(foreground), luminance(background));
      const dark = Math.min(luminance(foreground), luminance(background));
      return (light + 0.05) / (dark + 0.05);
    };
    return elements
      .filter((element) => {
        const style = globalThis.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && element.getBoundingClientRect().width > 0;
      })
      .map((element) => ({
        label: `${element.tagName.toLowerCase()}.${element.className}`,
        ratio: contrastRatio(element),
      }))
      .filter(({ ratio }) => ratio !== null);
  });
  for (const { label, ratio } of ratios) {
    expect(ratio, `${label} WCAG-oriented text contrast`).toBeGreaterThanOrEqual(4.5);
  }
}

const screenshotOptions = {
  animations: "disabled",
  caret: "hide",
  scale: "css",
  maxDiffPixels: 0,
};
