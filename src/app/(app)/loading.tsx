export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <div className="hidden h-[81px] items-center border-b border-line px-8 lg:flex">
        <div className="skeleton h-7 w-48 rounded-md" />
      </div>
      <div className="flex flex-1 gap-4 p-5 lg:pl-8">
        <div className="flex w-full flex-col gap-4 lg:w-[250px]">
          <div className="skeleton h-[41px] rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-md" />
          ))}
        </div>
        <div className="hidden flex-1 flex-col gap-3 lg:flex">
          <div className="skeleton h-7 w-2/3 rounded-md" />
          <div className="skeleton h-4 w-1/3 rounded-md" />
          <div className="skeleton h-40 rounded-md" />
        </div>
      </div>
    </div>
  );
}
