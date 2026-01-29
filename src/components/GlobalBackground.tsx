import abstractImage from '@/assets/abstract-login.jpg';

const GlobalBackground = () => {
    return (
        <div className="fixed inset-0 pointer-events-none z-0">
            <img
                src={abstractImage}
                alt=""
                className="absolute inset-0 w-full h-full opacity-30 object-cover"
                // Using standard lowercase for React compatibility to avoid warnings
                // @ts-ignore
                fetchpriority="high"
            />
            <div className="absolute inset-0 bg-white/95 dark:bg-black/95 backdrop-blur-xl" />
        </div>
    );
};

export default GlobalBackground;
