export default function ShelfLoading() {
  return (
    <div className="flex px-5">
      <div className="grid grid-cols-[16px_auto_16px] pb-[88px] w-full relative">
        {/* Top shelf surface */}
        <div className="col-span-3 flex h-[40px]">
          <div className="w-[40px] shrink-0 relative overflow-hidden">
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              aria-hidden="true"
              style={{ display: "block" }}
            >
              <polygon points="0,40 40,40 40,0" fill="#F5F5F5" />
              <line
                x1="0"
                y1="40"
                x2="40"
                y2="0"
                stroke="#dddddd"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          <div className="flex-1 bg-[#F5F5F5] border-t border-[#dddddd]" />
          <div className="w-[40px] shrink-0 relative overflow-hidden">
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              aria-hidden="true"
              style={{ display: "block" }}
            >
              <polygon points="0,0 0,40 40,40" fill="#F5F5F5" />
              <line
                x1="0"
                y1="0"
                x2="40"
                y2="40"
                stroke="#dddddd"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>

        <div className="w-4 h-full border border-solid border-[#DDDDDD]" />
        <div className="flex-1 flex-col w-full h-full">
          <div className="w-full h-4 border border-[#DDDDDD] border-r-0 border-l-0" />
          {/* One row of pulsing placeholder tiles */}
          <div className="flex flex-row items-stretch bg-[#F4F4F4] overflow-hidden">
            <div className="flex flex-col shrink-0 w-[40px]">
              <div className="flex-1 bg-[#E6E6E6]" />
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                aria-hidden="true"
                style={{ display: "block", flexShrink: 0 }}
              >
                <polygon points="0,0 40,0 0,40" style={{ fill: "#E6E6E6" }} />
                <polygon
                  points="40,0 40,40 0,40"
                  style={{ fill: "transparent" }}
                />
              </svg>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="flex-1 grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2 p-2 pb-2 pt-4 items-end overflow-hidden bg-[#d5d5d5]">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-full animate-pulse bg-[#bbb] rounded-sm"
                    style={{ aspectRatio: "2 / 3" }}
                  />
                ))}
              </div>
              <div className="h-[40px] w-full bg-[#f5f5f5] shrink-0 absolute bottom-0 left-0 z-[1]" />
            </div>
            <div className="flex flex-col shrink-0 w-[40px]">
              <div className="flex-1 bg-[#E0E0E0]" />
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                aria-hidden="true"
                style={{ display: "block", flexShrink: 0 }}
              >
                <polygon points="0,0 40,0 40,40" style={{ fill: "#E0E0E0" }} />
                <polygon
                  points="0,0 0,40 40,40"
                  style={{ fill: "transparent" }}
                />
              </svg>
            </div>
          </div>
          <div className="h-4 flex w-full border-t border-b border-[#DDDDDD] bg-[#F4F4F4]" />
        </div>
        <div className="w-4 h-full border border-solid border-[#DDDDDD]" />
      </div>
    </div>
  );
}
