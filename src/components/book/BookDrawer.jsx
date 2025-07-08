"use client"
import React, { forwardRef, useImperativeHandle, useRef } from "react"
import { Drawer } from "vaul"
import { Button } from "@/components/ui/button"

const VaulDrawer = forwardRef(({ book, coverUrl }, ref) => {
  const { title, author, description, amazon_affiliate_link } = book
  const triggerRef = useRef()

  useImperativeHandle(ref, () => ({
    open: () => {
      if (triggerRef.current) {
        triggerRef.current.click()
      }
    }
  }))

  console.log("VaulDrawer rendered with book:", book, book.title)

  return (
    <Drawer.Root direction="right">
      <Drawer.Trigger ref={triggerRef} className="hidden" />
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-10" />
        <Drawer.Content
          className="right-0 top-0 bottom-0 fixed z-10 outline-none w-[480px] max-w-full flex h-full" // Add h-full here
          style={{ "--initial-transform": "calc(100% + 8px)" }}
        >
          <section className="drawer-container bg-white w-[480px] h-full flex flex-row">
            <div className="drawer-left w-4 h-full border border-solid border-border"></div>
            <div className="drawer-center w-full h-full flex flex-col">
              <div className="drawer-top w-full h-4 border-1 border-border border flex border-r-0 border-l-0"></div>
              <div className="drawer-content overflow-y-scroll flex flex-col h-full items-center justify-start">
                <div className="content-container flex flex-col w-full max-w-full h-auto">
                  <div className="flex flex-col items-center gap-4 w-full bg-[rgba(0,0,0,0.1)] p-10">
                    {coverUrl && (
                      <img
                        src={coverUrl}
                        alt={`${title} cover`}
                        className="h-auto w-[50%] self-center shadow-[0_0_64px_8px_rgba(0,0,0,0.2)]"
                      />
                    )}
                  </div>
                  <div className="p-10 flex flex-col gap-5 w-full max-w-full">
                    <div>
                      <Drawer.Title className="text-[16px] text-textPrimary font-departureMono uppercase">
                        {title}
                      </Drawer.Title>
                      <Drawer.Description className="text-[16px] font-departureMono uppercase text-textSecondary">
                        By <span className="text-textPrimary">{author}</span>
                      </Drawer.Description>
                      <div className="text-[12px] font-inter text-textSecondary mt-2">
                        {description
                          ? description.split("\n").map((paragraph, index) => (
                              <p key={index} className="mb-2">
                                {paragraph}
                              </p>
                            ))
                          : "No description available."}
                      </div>
                    </div>
                    {amazon_affiliate_link && (
                      <Button
                        asChild
                        className="text-sm items-center w-full flex justify-between font-departureMono uppercase font-normal text-[13px]"
                        variant="default"
                      >
                        <a href={amazon_affiliate_link} target="_blank" rel="noopener noreferrer">
                          Buy on Amazon <img src="/icons/trolley.svg" alt="cart" className="ml-2" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="drawer-bottom w-full h-4 border-1 border-border border flex border-r-0 border-l-0"></div>
            </div>
            <div className="drawer-right w-4 h-full border border-solid border-border"></div>
          </section>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
})

VaulDrawer.displayName = "VaulDrawer"

export default VaulDrawer
