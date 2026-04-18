import { Tile, Tag } from '@carbon/react';
import { ArrowRight, ArrowUp, ArrowDown, Subtract } from '@carbon/icons-react';
import type { MockPlant, Tier } from './data';

interface PlantCardProps {
  plant: MockPlant;
  onOpen: (plant: MockPlant) => void;
}

const TIER_TAG: Record<Tier, 'red' | 'warm-gray' | 'green'> = {
  RED: 'red',
  AMBER: 'warm-gray',
  GREEN: 'green',
};

const TIER_LABEL: Record<Tier, string> = {
  RED: 'Needs attention',
  AMBER: 'Monitor',
  GREEN: 'Healthy',
};

function DeltaIndicator({ delta }: { delta: number }) {
  if (delta > 0) return <ArrowUp size={14} aria-label={`+${delta}`} />;
  if (delta < 0) return <ArrowDown size={14} aria-label={`${delta}`} />;
  return <Subtract size={14} aria-label="no change" />;
}

export default function PlantCard({ plant, onOpen }: PlantCardProps) {
  return (
    <Tile
      className={`em-plant-card em-plant-card--${plant.tier.toLowerCase()}`}
      onClick={() => onOpen(plant)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(plant);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${plant.name}, ${TIER_LABEL[plant.tier]}: ${plant.headline}`}
    >
      <div className="em-plant-card__header">
        <Tag type={TIER_TAG[plant.tier]} size="sm" className="em-plant-card__tier">
          {TIER_LABEL[plant.tier]}
        </Tag>
        <span className="em-plant-card__id">{plant.id}</span>
      </div>

      <div className="em-plant-card__name">{plant.name}</div>
      <div className="em-plant-card__region">
        {plant.region}, {plant.country}
      </div>

      <div className="em-plant-card__headline">{plant.headline}</div>

      <div className="em-plant-card__lastfail">
        {plant.last_fail ? (
          <>
            <span className="em-plant-card__lastfail-label">Last fail</span>
            <span className="em-plant-card__lastfail-value">
              {plant.last_fail.mic} · {plant.last_fail.location} ·{' '}
              {plant.last_fail.days_ago}d ago
            </span>
          </>
        ) : (
          <>
            <span className="em-plant-card__lastfail-label">Last fail</span>
            <span className="em-plant-card__lastfail-value em-plant-card__lastfail-value--muted">
              None on record
            </span>
          </>
        )}
      </div>

      <div className="em-plant-card__stats">
        <div className="em-plant-card__stat">
          <div className="em-plant-card__stat-label">Coverage</div>
          <div className="em-plant-card__stat-value">{plant.coverage_pct}%</div>
        </div>
        <div className="em-plant-card__stat">
          <div className="em-plant-card__stat-label">SPC warnings</div>
          <div className="em-plant-card__stat-value">
            {plant.spc_warnings_active}
            <span className="em-plant-card__delta">
              <DeltaIndicator delta={plant.spc_warnings_delta_7d} />
              {plant.spc_warnings_delta_7d !== 0 && (
                <span>{Math.abs(plant.spc_warnings_delta_7d)}</span>
              )}
            </span>
          </div>
        </div>
        <div className="em-plant-card__stat">
          <div className="em-plant-card__stat-label">Active fails</div>
          <div className="em-plant-card__stat-value">{plant.active_fails}</div>
        </div>
      </div>

      <div className="em-plant-card__footer">
        <span className="em-plant-card__last">Last inspection {plant.last_inspection}</span>
        <span className="em-plant-card__open">
          {plant.hasFloorplan ? 'View plant' : 'No floor plan yet'}
          <ArrowRight size={14} />
        </span>
      </div>
    </Tile>
  );
}
