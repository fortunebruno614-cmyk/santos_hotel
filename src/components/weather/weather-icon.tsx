import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react";

/**
 * WMO weather-code → icon. `isDay` only changes the clear/partly-cloudy icons;
 * rain, snow, fog and storms look the same at night.
 *
 * A switch (rather than a dynamically selected component) keeps the lint
 * "static components" rule happy and avoids remounting on every render.
 */
export function WeatherIcon({
  code,
  isDay = true,
  className,
}: {
  code: number;
  isDay?: boolean;
  className?: string;
}) {
  if (code === 0 || code === 1) {
    return isDay ? (
      <Sun className={className} aria-hidden="true" />
    ) : (
      <Moon className={className} aria-hidden="true" />
    );
  }
  if (code === 2) {
    return isDay ? (
      <CloudSun className={className} aria-hidden="true" />
    ) : (
      <CloudMoon className={className} aria-hidden="true" />
    );
  }
  if (code === 3) return <Cloud className={className} aria-hidden="true" />;
  if (code === 45 || code === 48) {
    return <CloudFog className={className} aria-hidden="true" />;
  }
  if (code >= 51 && code <= 57) {
    return <CloudDrizzle className={className} aria-hidden="true" />;
  }
  if (code >= 61 && code <= 67) {
    return <CloudRain className={className} aria-hidden="true" />;
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return <CloudSnow className={className} aria-hidden="true" />;
  }
  if (code >= 80 && code <= 82) {
    return <CloudRain className={className} aria-hidden="true" />;
  }
  if (code >= 95) return <CloudLightning className={className} aria-hidden="true" />;
  return <Cloud className={className} aria-hidden="true" />;
}
