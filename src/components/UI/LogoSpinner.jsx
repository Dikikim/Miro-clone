// Loading indicator: the KKOT logo (transp_bg.png) spinning, used everywhere a
// spinner is needed (PDF rendering, uploads, video buffering) instead of a plain
// circle. The logo is a square transparent PNG, so it drops cleanly onto any
// surface and rotates around its centre.
export default function LogoSpinner({ className = 'w-8 h-8', style }) {
    return (
        <img
            src="/logo-icon.png"
            alt="Loading"
            draggable={false}
            className={`${className} animate-spin select-none pointer-events-none object-contain`}
            style={{ animationDuration: '1.1s', background: 'transparent', ...style }}
        />
    );
}
