import { expect, test } from "@playwright/test";

test("shows the testnet boundary and disables creation without a reviewed factory", async ({ page }) => {
  await page.route("http://localhost:4000/v1/tokens**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    }),
  );

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Launch ideas/ })).toBeVisible();
  await expect(page.getByText("TESTNET ONLY")).toBeVisible();
  await expect(page.getByText(/Factory address is not configured/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create fixed-supply token" })).toBeDisabled();
});

test("shows an indexer failure without breaking the launchpad", async ({ page }) => {
  await page.route("http://localhost:4000/v1/tokens**", (route) => route.abort());

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Create\. Trade\./ })).toBeVisible();
  await expect(page.getByText(/Could not load the indexer API/)).toBeVisible();
});
