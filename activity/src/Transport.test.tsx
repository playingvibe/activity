import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TrackAnnouncement, trackAnnouncement } from "./Transport";
import type { Track } from "./syncTypes";

const track = (over: Partial<Track> = {}): Track => ({ title: "Song", author: "Artist", uri: "u", isStream: false, ...over }) as Track;

describe("the song-change announcement", () => {
  it("names the song and its artist", () => {
    expect(trackAnnouncement(track())).toBe("Now playing: Song by Artist");
  });

  it("copes with a song that has no title or no artist", () => {
    expect(trackAnnouncement(track({ author: undefined }))).toBe("Now playing: Song");
    expect(trackAnnouncement(track({ title: undefined }))).toBe("Now playing: Unknown track by Artist");
  });

  it("is a polite live region, out of sight, holding that text", () => {
    const html = renderToStaticMarkup(<TrackAnnouncement track={track()} />);

    expect(html).toContain('role="status"');
    expect(html).toContain("Now playing: Song by Artist");
    expect(html).toContain("clip:rect(0 0 0 0)");
  });
});
