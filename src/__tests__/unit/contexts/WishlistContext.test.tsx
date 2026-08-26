import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WishlistProvider, useWishlist } from "../../../app/contexts/WishlistContext";

const TestComponent = () => {
  const { favoriteIds, count, isFavorite, toggleFavorite, addFavorite, removeFavorite, clearFavorites } = useWishlist();
  return (
    <div>
      <span data-testid="count">{count}</span>
      <span data-testid="ids">{favoriteIds.join(",")}</span>
      <span data-testid="is-prop1">{isFavorite("prop-1") ? "yes" : "no"}</span>
      <button data-testid="add-prop1" onClick={() => addFavorite("prop-1")}>Add 1</button>
      <button data-testid="add-prop2" onClick={() => addFavorite("prop-2")}>Add 2</button>
      <button data-testid="remove-prop1" onClick={() => removeFavorite("prop-1")}>Remove 1</button>
      <button data-testid="toggle-prop1" onClick={() => toggleFavorite("prop-1")}>Toggle 1</button>
      <button data-testid="clear" onClick={clearFavorites}>Clear</button>
    </div>
  );
};

describe("WishlistContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should return default fallback context when useWishlist is used outside WishlistProvider", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(screen.getByTestId("ids").textContent).toBe("");
    expect(screen.getByTestId("is-prop1").textContent).toBe("no");
  });

  it("should initialize empty when localStorage has no wishlist", () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(screen.getByTestId("ids").textContent).toBe("");
    expect(screen.getByTestId("is-prop1").textContent).toBe("no");
  });

  it("should initialize with existing favorites from localStorage", () => {
    localStorage.setItem("viterra_wishlist_properties", JSON.stringify(["prop-1", "prop-3"]));

    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.getByTestId("ids").textContent).toBe("prop-1,prop-3");
    expect(screen.getByTestId("is-prop1").textContent).toBe("yes");
  });

  it("should add, remove, toggle and clear favorites correctly and update localStorage", async () => {
    const user = userEvent.setup();

    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    // Add prop-1
    await user.click(screen.getByTestId("add-prop1"));
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("is-prop1").textContent).toBe("yes");
    expect(localStorage.getItem("viterra_wishlist_properties")).toBe(JSON.stringify(["prop-1"]));

    // Add prop-2
    await user.click(screen.getByTestId("add-prop2"));
    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.getByTestId("ids").textContent).toBe("prop-1,prop-2");

    // Toggle prop-1 (removes it)
    await user.click(screen.getByTestId("toggle-prop1"));
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("is-prop1").textContent).toBe("no");

    // Toggle prop-1 again (adds it back)
    await user.click(screen.getByTestId("toggle-prop1"));
    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.getByTestId("is-prop1").textContent).toBe("yes");

    // Clear
    await user.click(screen.getByTestId("clear"));
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(screen.getByTestId("ids").textContent).toBe("");
    expect(localStorage.getItem("viterra_wishlist_properties")).toBe(JSON.stringify([]));
  });
});
