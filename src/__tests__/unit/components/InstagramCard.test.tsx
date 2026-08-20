import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LazyInstagramCard } from "../../../app/pages/HomePage";
import { LocaleProvider } from "../../../app/i18n/LocaleContext";
import { MemoryRouter } from "react-router";

// Mock IntersectionObserver to immediately trigger inView = true
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly scrollMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(private callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [
        {
          isIntersecting: true,
          target,
          intersectionRatio: 1,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: Date.now(),
        },
      ],
      this
    );
  }

  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

describe("LazyInstagramCard Component", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("renders standard image post with valid links and image src", () => {
    const post = {
      shortcode: "ABC12345",
      type: "p" as const,
      videoUrl: null,
      thumbnail: "https://example.com/thumbnail.jpg",
      caption: "Publicación de prueba sobre inmuebles en Querétaro",
    };

    render(
      <MemoryRouter>
        <LocaleProvider>
          <LazyInstagramCard post={post} />
        </LocaleProvider>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "https://www.instagram.com/p/ABC12345/"
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/thumbnail.jpg");
    expect(screen.getByText(/Publicación de prueba sobre inmuebles/)).toBeInTheDocument();
  });

  it("renders reel video post with reel link and video tag", () => {
    const post = {
      shortcode: "REEL999",
      type: "reel" as const,
      videoUrl: "https://example.com/video.mp4",
      thumbnail: "https://example.com/thumb.jpg",
      caption: "Reel inmobiliario destacado",
    };

    render(
      <MemoryRouter>
        <LocaleProvider>
          <LazyInstagramCard post={post} />
        </LocaleProvider>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "https://www.instagram.com/reel/REEL999/"
    );

    const video = screen.getByText((content, element) => element?.tagName.toLowerCase() === "video");
    expect(video).toBeInTheDocument();
  });

  it("switches to embed iframe fallback when image fails to load (onError)", () => {
    const post = {
      shortcode: "BROKEN123",
      type: "p" as const,
      videoUrl: null,
      thumbnail: "https://example.com/broken.jpg",
      caption: "Imagen que fallará",
    };

    render(
      <MemoryRouter>
        <LocaleProvider>
          <LazyInstagramCard post={post} />
        </LocaleProvider>
      </MemoryRouter>,
    );

    const img = screen.getByRole("img");
    fireEvent.error(img);

    const iframe = screen.getByTitle("Publicación de Instagram BROKEN123");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.instagram.com/p/BROKEN123/embed/captioned"
    );
  });

  it("uses embed iframe fallback directly when thumbnail and videoUrl are null", () => {
    const post = {
      shortcode: "NOMEDIA1",
      type: "p" as const,
      videoUrl: null,
      thumbnail: null,
      caption: "Post sin archivo multimedia estático",
    };

    render(
      <MemoryRouter>
        <LocaleProvider>
          <LazyInstagramCard post={post} />
        </LocaleProvider>
      </MemoryRouter>,
    );

    const iframe = screen.getByTitle("Publicación de Instagram NOMEDIA1");
    expect(iframe).toBeInTheDocument();
  });
});
