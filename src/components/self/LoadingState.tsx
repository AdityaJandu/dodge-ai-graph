
import { Spinner } from "../ui/spinner";

interface Props {
    title: string;
    descr: string;
};

export default function LoadingState({
    title,
    descr
}: Props) {
    return (
        <div className="py-4 px-8 flex flex-1 items-center justify-center bg-transparent">
            <div className="flex flex-col items-center justify-center gap-y-6 bg-background rounded-lg p-10 shadow-sm">
                <Spinner className="size-8 text-primary" />
                <div className="flex flex-col gap-y-2 text-center max-w-md">
                    <h6 className="text-lg font-medium">{title}</h6>
                    <p className="text-sm">{descr}</p>
                </div>
            </div>
        </div>
    );
};
