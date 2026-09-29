// SIDE QUEST — ProductCard
// Ported from ProductCard.dc.html (Claude Design Component) to React.
import React from 'react';
import { L, S, T } from './dc-compat.js';
import ProductImage from './ProductImage.jsx';

export default function ProductCard(props) {
  const v = props;
  return (
    <div className="sc-host" style={props.__hostStyle}>
      <article
        className="sqp5"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--color-bg)',
          border: '1px solid var(--color-divider)',
        }}
      >
        {' '}
        <a
          href={v.p?.href}
          aria-label={v.p?.name}
          style={{ position: 'relative', display: 'block', aspectRatio: '1/1' }}
        >
          {' '}
          <ProductImage image={v.p?.image} __hostStyle={{ position: 'absolute', inset: '0' }} />{' '}
          {v.p?.hasBadge ? (
            <>
              {' '}
              <span
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '.06em',
                  background: v.p?.badgeBg,
                  color: v.p?.badgeFg,
                }}
              >
                {T(v.p?.badge)}
              </span>{' '}
            </>
          ) : null}{' '}
        </a>{' '}
        <button
          aria-label={'Toggle wishlist'}
          onClick={v.p?.onWish}
          className="sqp5"
          style={{
            position: 'relative',
            margin: '-46px 10px 10px auto',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-divider)',
            cursor: 'pointer',
            color: v.p?.heartColor,
          }}
        >
          {' '}
          <svg
            width={'18'}
            height={'18'}
            viewBox={'0 0 24 24'}
            fill={v.p?.heartFill}
            stroke={'currentColor'}
            strokeWidth={'2'}
            strokeLinecap={'round'}
            strokeLinejoin={'round'}
          >
            <path
              d={
                'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
              }
            ></path>
          </svg>{' '}
        </button>{' '}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '14px',
            flex: '1',
            borderTop: '1px solid var(--color-divider)',
          }}
        >
          {' '}
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: 'var(--color-accent-700)',
              fontWeight: '600',
            }}
          >
            {T(v.p?.catLabel)}
          </div>{' '}
          <a
            href={v.p?.href}
            style={{
              fontWeight: '800',
              fontSize: '15px',
              lineHeight: '1.25',
              color: 'var(--color-text)',
              textDecoration: 'none',
              display: '-webkit-box',
              WebkitLineClamp: '2',
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textWrap: 'pretty',
            }}
          >
            {T(v.p?.name)}
          </a>{' '}
          {v.p?.hasMeta ? (
            <>
              <div style={{ fontSize: '12px', color: 'var(--color-neutral-700)' }}>{T(v.p?.meta)}</div>
            </>
          ) : null}{' '}
          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              alignItems: 'baseline',
              gap: '8px',
              flexWrap: 'wrap',
              paddingTop: '6px',
            }}
          >
            {' '}
            <span style={{ fontSize: '19px', fontWeight: '800', color: v.p?.priceColor }}>
              {T(v.p?.priceText)}
            </span>{' '}
            {v.p?.hasSale ? (
              <>
                <span style={{ fontSize: '13px', textDecoration: 'line-through', color: 'var(--color-neutral-600)' }}>
                  {T(v.p?.origPriceText)}
                </span>
              </>
            ) : null}{' '}
          </div>{' '}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <span style={{ width: '8px', height: '8px', flex: 'none', background: v.p?.availDot }}></span>
            {T(v.p?.availText)}
          </div>{' '}
          <button
            disabled={v.p?.soldOut}
            onClick={v.p?.onAdd}
            className="btn btn-primary"
            style={{ justifyContent: 'space-between', width: '100%', marginTop: '6px', padding: '11px 12px' }}
          >
            {' '}
            <span>{T(v.p?.addLabel)}</span>{' '}
            <svg
              width={'16'}
              height={'16'}
              viewBox={'0 0 24 24'}
              fill={'none'}
              stroke={'currentColor'}
              strokeWidth={'2.5'}
              strokeLinecap={'round'}
              strokeLinejoin={'round'}
            >
              <path d={'M5 12h14M12 5v14'}></path>
            </svg>{' '}
          </button>{' '}
        </div>
      </article>
    </div>
  );
}
