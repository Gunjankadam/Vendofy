import abstractImage from '@/assets/abstract-login.jpg';

const GlobalBackground = () => {
    return (
        <div className="fixed inset-0 pointer-events-none z-[-1]">
            <img
                src={abstractImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                // @ts-ignore
                fetchpriority="high"
            />
            {/* Overlay to ensure text readability while keeping abstract visible */}
            <div className="absolute inset-0 bg-white/70 dark:bg-black/70" />
        </div>
    );
};

export default GlobalBackground;
