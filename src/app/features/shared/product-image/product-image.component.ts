import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-product-image',
  host: {
    '[style.--product-image-size.px]': 'normalizedSize()',
    '[class.full-size]': 'fullSize()',
  },
  template: `
    <img
      [src]="resolvedSrc()"
      [alt]="alt()"
      [attr.loading]="priority() ? 'eager' : 'lazy'"
      decoding="async"
      [attr.fetchpriority]="priority() ? 'high' : 'low'"
    />
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        max-width: var(--product-image-size);
        max-height: var(--product-image-size);
        overflow: hidden;
      }

      :host(.full-size) {
        max-width: none;
        max-height: none;
      }

      img {
        display: block;
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
    `,
  ],
})
export class ProductImageComponent {
  readonly src = input<string | null | undefined>('');
  readonly alt = input('');
  readonly size = input(120);
  readonly fullSize = input(false);
  readonly priority = input(false);

  readonly normalizedSize = computed(() => Math.min(Math.max(Math.round(this.size()), 48), 320));

  readonly resolvedSrc = computed(() => {
    const rawValue = String(this.src() || '').trim();

    if (!rawValue || this.fullSize()) {
      return rawValue;
    }

    const normalizedSize = this.normalizedSize();
    const assetMatch = rawValue.match(/^\/api\/product-images\/(.+)$/);

    if (assetMatch) {
      return `/api/product-image-thumbnails/assets/${assetMatch[1]}?size=${normalizedSize}`;
    }

    const localMatch = rawValue.match(/^\/api\/product-images-local\/([^/?#]+)/);

    if (localMatch) {
      return `/api/product-image-thumbnails/local/${localMatch[1]}?size=${normalizedSize}`;
    }

    return rawValue;
  });
}
