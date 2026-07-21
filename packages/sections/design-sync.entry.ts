/**
 * design-sync bundle entry for @fable/sections (claude.ai/design import).
 *
 * The package's real entry (src/index.ts) exposes sections only through the
 * registry (`registry.hero.Component`), but claude.ai/design needs each
 * component as a named export on the window global. This file re-exports the
 * package's own modules — no reimplementation, just a flat export surface.
 * Referenced by .design-sync/config.json ("entry"); lives at the package root
 * so the converter resolves the package dir from it.
 */
import "./design-sync.shim";

export * from "./src/index";

export { Hero } from "./src/hero/Hero";
export { RichTextSection } from "./src/rich_text/RichTextSection";
export { FeatureGrid } from "./src/feature_grid/FeatureGrid";
export { ImageTextSplit } from "./src/image_text_split/ImageTextSplit";
export { Testimonials } from "./src/testimonials/Testimonials";
export { CtaBanner } from "./src/cta_banner/CtaBanner";
export { FaqAccordion } from "./src/faq_accordion/FaqAccordion";
export { ContactForm } from "./src/contact_form/ContactForm";
export { Gallery } from "./src/gallery/Gallery";
export { LogoStrip } from "./src/logo_strip/LogoStrip";
