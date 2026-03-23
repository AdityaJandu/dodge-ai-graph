import { Loader2Icon } from "lucide-react";

export default function LoadingState() {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#fffefc]">
            <Loader2Icon className="animate-spin text-gray-400 mb-2" size={24} />
            <p className="text-sm text-gray-500 font-medium">Rendering Enterprise Graph Engine...</p>
        </div>
    );
}