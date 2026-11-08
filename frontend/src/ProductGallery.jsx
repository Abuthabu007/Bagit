import { useState } from "react";
import { availableProductPhotoCounts } from "./productPhotoCounts.js";

function ProductGallery({ product, categoryIcon, attributions, detail = false, onOpen }) {
  const imageCount = availableProductPhotoCounts[product.id] ?? 0;
  const [activeImage, setActiveImage] = useState(0);

  if (imageCount === 0) {
    return (
      <div
        className={detail ? "product-art product-art-detail" : "product-art"}
        aria-hidden="true"
      >
        <span>{categoryIcon}</span>
        <small>{product.categoryName}</small>
      </div>
    );
  }

  const fileName = `${product.id}-${String(activeImage + 1).padStart(2, "0")}.jpg`;
  const attribution = attributions[fileName];

  return (
    <figure
      className={detail ? "product-gallery product-gallery-detail" : "product-gallery"}
      aria-label={`${product.name} photo gallery`}
    >
      <div className="gallery-media">
        <button
          className="gallery-image-button"
          type="button"
          onClick={onOpen}
          aria-label={`View details for ${product.name}`}
        >
          <img
            src={`/images/products/${fileName}`}
            alt={`${product.name}, photo ${activeImage + 1} of ${imageCount}`}
            loading="lazy"
            decoding="async"
          />
        </button>
        <button
          className="gallery-arrow gallery-previous"
          type="button"
          aria-label={`Previous photo of ${product.name}`}
          disabled={activeImage === 0}
          onClick={() => setActiveImage((index) => Math.max(0, index - 1))}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m10 3-5 5 5 5" />
          </svg>
        </button>
        <button
          className="gallery-arrow gallery-next"
          type="button"
          aria-label={`Next photo of ${product.name}`}
          disabled={activeImage === imageCount - 1}
          onClick={() => setActiveImage((index) => Math.min(imageCount - 1, index + 1))}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
      </div>
      <figcaption className="gallery-caption">
        <span>{activeImage + 1} / {imageCount}</span>
        {attribution ? (
          <span className="gallery-credit">
            <a href={attribution.sourcePage} target="_blank" rel="noreferrer">
              Photo: {attribution.creator || "Wikimedia Commons"}
            </a>
            {" · "}
            <a href={attribution.licenseUrl} target="_blank" rel="noreferrer">
              {attribution.license}
            </a>
          </span>
        ) : (
          <span className="gallery-credit">Photo credit unavailable</span>
        )}
      </figcaption>
    </figure>
  );
}

export default ProductGallery;
