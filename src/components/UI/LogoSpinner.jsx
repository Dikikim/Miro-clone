// Loading indicator: the KOT flower logo spinning, used everywhere a spinner is
// needed (PDF rendering, uploads, video buffering) instead of a plain circle.
// `logo-spinner.png` is a square, centred crop of the logo with an absolutely
// transparent background (the source PNG's faint haze was stripped), so it drops
// cleanly onto any surface and rotates around its centre without wobble.
export default function LogoSpinner({ className = 'w-8 h-8', style }) {
    return (
        <img
            src="/logo-spinner.png"
            alt="Loading"
            draggable={false}
            className={`${className} animate-spin select-none pointer-events-none object-contain`}
            style={{ animationDuration: '1.1s', background: 'transparent', ...style }}
        />
    );
}
