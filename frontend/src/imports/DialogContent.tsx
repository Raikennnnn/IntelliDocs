import svgPaths from "./svg-rtbbmivqpn";

function DialogTitle() {
  return (
    <div className="h-[18px] relative shrink-0 w-[578.5px]" data-name="DialogTitle">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[18px] left-0 not-italic text-[#1a1a1a] text-[18px] top-[-1px] whitespace-nowrap">Application Review - ENR001</p>
      </div>
    </div>
  );
}

function DialogDescription() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[578.5px]" data-name="DialogDescription">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[20px] min-h-px min-w-px not-italic relative text-[#6b7280] text-[14px]">Review enrollment application for Carlos Rodriguez</p>
      </div>
    </div>
  );
}

function DialogHeader() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[8px] h-[46px] items-start left-[24px] top-[24px] w-[578.5px]" data-name="DialogHeader">
      <DialogTitle />
      <DialogDescription />
    </div>
  );
}

function TabsTrigger() {
  return (
    <div className="absolute content-stretch flex h-[29px] items-center justify-center left-[3px] px-[9px] py-[5px] rounded-[14px] top-[3.5px] w-[190.828px]" data-name="TabsTrigger">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0)] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[20px] not-italic relative shrink-0 text-[#1a1a1a] text-[14px] text-center whitespace-nowrap">Student Info</p>
    </div>
  );
}

function TabsTrigger1() {
  return (
    <div className="absolute bg-white content-stretch flex h-[29px] items-center justify-center left-[193.83px] px-[9px] py-[5px] rounded-[14px] top-[3.5px] w-[190.828px]" data-name="TabsTrigger">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0)] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[20px] not-italic relative shrink-0 text-[#1a1a1a] text-[14px] text-center whitespace-nowrap">Documents (3)</p>
    </div>
  );
}

function TabsTrigger2() {
  return (
    <div className="absolute content-stretch flex h-[29px] items-center justify-center left-[384.66px] px-[9px] py-[5px] rounded-[14px] top-[3.5px] w-[190.828px]" data-name="TabsTrigger">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0)] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[20px] not-italic relative shrink-0 text-[#1a1a1a] text-[14px] text-center whitespace-nowrap">Audit Trail (1)</p>
    </div>
  );
}

function TabsList() {
  return (
    <div className="bg-[#f5f5f5] h-[36px] relative rounded-[14px] shrink-0 w-[578.5px]" data-name="TabsList">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <TabsTrigger />
        <TabsTrigger1 />
        <TabsTrigger2 />
      </div>
    </div>
  );
}

function FileText() {
  return (
    <div className="absolute left-0 size-[16px] top-[3.5px]" data-name="FileText">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="FileText">
          <path d={svgPaths.p19416e00} id="Vector" stroke="var(--stroke-0, #1C398E)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p3e059a80} id="Vector_2" stroke="var(--stroke-0, #1C398E)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M6.66667 6H5.33333" id="Vector_3" stroke="var(--stroke-0, #1C398E)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M10.6667 8.66667H5.33333" id="Vector_4" stroke="var(--stroke-0, #1C398E)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M10.6667 11.3333H5.33333" id="Vector_5" stroke="var(--stroke-0, #1C398E)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function P() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="p">
      <FileText />
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[0] left-[24px] not-italic text-[#1c398e] text-[0px] text-[14px] top-[-1px] whitespace-nowrap">
        <span className="leading-[20px]">{`Total Documents Submitted: `}</span>
        <span className="font-['Inter:Bold',sans-serif] font-bold leading-[20px]">3</span>
      </p>
    </div>
  );
}

function Div() {
  return (
    <div className="bg-[#eff6ff] h-[46px] relative rounded-[10px] shrink-0 w-full" data-name="div">
      <div aria-hidden="true" className="absolute border border-[#bedbff] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="content-stretch flex flex-col items-start pb-px pt-[13px] px-[13px] relative size-full">
        <P />
      </div>
    </div>
  );
}

function FileText1() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="FileText">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="FileText">
          <path d={svgPaths.p3713e00} id="Vector" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.pd2076c0} id="Vector_2" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M8.33333 7.5H6.66667" id="Vector_3" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M13.3333 10.8333H6.66667" id="Vector_4" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M13.3333 14.1667H6.66667" id="Vector_5" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Container3() {
  return (
    <div className="bg-[#fef2f2] relative rounded-[10px] shrink-0 size-[40px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <FileText1 />
      </div>
    </div>
  );
}

function P1() {
  return (
    <div className="absolute content-stretch flex h-[20px] items-start left-0 overflow-clip top-0 w-[291.297px]" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Medium',sans-serif] font-medium leading-[20px] min-h-px min-w-px not-italic relative text-[#101828] text-[14px]">Birth Certificate - Carlos Rodriguez.pdf</p>
    </div>
  );
}

function P2() {
  return (
    <div className="absolute content-stretch flex h-[16px] items-start left-0 top-[24px] w-[291.297px]" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#6a7282] text-[12px]">Uploaded: 2026-02-20</p>
    </div>
  );
}

function Badge() {
  return (
    <div className="absolute h-[22px] left-0 rounded-[8px] top-[48px] w-[103.703px]" data-name="Badge">
      <div className="content-stretch flex items-center justify-center overflow-clip px-[9px] py-[3px] relative rounded-[inherit] size-full">
        <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[#1a1a1a] text-[12px] whitespace-nowrap">Birth Certificate</p>
      </div>
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8px]" />
    </div>
  );
}

function Container4() {
  return (
    <div className="flex-[1_0_0] h-[70px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <P1 />
        <P2 />
        <Badge />
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="flex-[1_0_0] h-[70px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-start relative size-full">
        <Container3 />
        <Container4 />
      </div>
    </div>
  );
}

function ExternalLink() {
  return (
    <div className="absolute left-[11px] size-[16px] top-[8px]" data-name="ExternalLink">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ExternalLink">
          <path d="M10 2H14V6" id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M6.66667 9.33333L14 2" id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p25f66900} id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button() {
  return (
    <div className="bg-white h-[32px] relative rounded-[8px] shrink-0 w-[77.688px]" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <ExternalLink />
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[52.5px] not-italic text-[#1a1a1a] text-[12px] text-center top-[8px] whitespace-nowrap">Open</p>
      </div>
    </div>
  );
}

function Download() {
  return (
    <div className="absolute left-[11px] size-[16px] top-[8px]" data-name="Download">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Download">
          <path d={svgPaths.p23ad1400} id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p19411800} id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M8 10V2" id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-white flex-[1_0_0] h-[32px] min-h-px min-w-px relative rounded-[8px]" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Download />
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[65px] not-italic text-[#1a1a1a] text-[12px] text-center top-[8px] whitespace-nowrap">Download</p>
      </div>
    </div>
  );
}

function Container5() {
  return (
    <div className="h-[32px] relative shrink-0 w-[189.203px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-start relative size-full">
        <Button />
        <Button1 />
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="bg-[#f9fafb] h-[103px] relative shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
      <div className="content-stretch flex items-start justify-between pb-px pt-[16px] px-[16px] relative size-full">
        <Container2 />
        <Container5 />
      </div>
    </div>
  );
}

function ZoomOut() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ZoomOut">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ZoomOut">
          <path d={svgPaths.p107a080} id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M14 14L11.1 11.1" id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M5.33333 7.33333H9.33333" id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button2() {
  return (
    <div className="h-[32px] relative rounded-[8px] shrink-0 w-[36px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <ZoomOut />
      </div>
    </div>
  );
}

function Span() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="flex-[1_0_0] font-['Inter:Medium',sans-serif] font-medium leading-[20px] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[14px] text-center">100%</p>
      </div>
    </div>
  );
}

function ZoomIn() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ZoomIn">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ZoomIn">
          <path d={svgPaths.p107a080} id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M14 14L11.1 11.1" id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M7.33333 5.33333V9.33333" id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M5.33333 7.33333H9.33333" id="Vector_4" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button3() {
  return (
    <div className="h-[32px] relative rounded-[8px] shrink-0 w-[36px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <ZoomIn />
      </div>
    </div>
  );
}

function Container8() {
  return (
    <div className="h-[32px] relative shrink-0 w-[148px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Button2 />
        <Span />
        <Button3 />
      </div>
    </div>
  );
}

function ChevronLeft() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ChevronLeft">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ChevronLeft">
          <path d="M10 12L6 8L10 4" id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button4() {
  return (
    <div className="h-[32px] opacity-50 relative rounded-[8px] shrink-0 w-[36px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <ChevronLeft />
      </div>
    </div>
  );
}

function Span1() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[#1a1a1a] text-[14px] whitespace-nowrap">Page 1 of 1</p>
      </div>
    </div>
  );
}

function ChevronRight() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ChevronRight">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ChevronRight">
          <path d="M6 12L10 8L6 4" id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button5() {
  return (
    <div className="h-[32px] opacity-50 relative rounded-[8px] shrink-0 w-[36px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <ChevronRight />
      </div>
    </div>
  );
}

function Container9() {
  return (
    <div className="h-[32px] relative shrink-0 w-[157.25px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Button4 />
        <Span1 />
        <Button5 />
      </div>
    </div>
  );
}

function Container7() {
  return (
    <div className="bg-white h-[49px] relative shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between pb-px px-[16px] relative size-full">
          <Container8 />
          <Container9 />
        </div>
      </div>
    </div>
  );
}

function FileText2() {
  return (
    <div className="absolute left-[199.75px] size-[64px] top-0" data-name="FileText">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 64 64">
        <g id="FileText">
          <path d={svgPaths.p3f6fb600} id="Vector" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
          <path d={svgPaths.p29192380} id="Vector_2" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
          <path d="M26.6667 24H21.3333" id="Vector_3" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
          <path d="M42.6667 34.6667H21.3333" id="Vector_4" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
          <path d="M42.6667 45.3333H21.3333" id="Vector_5" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
        </g>
      </svg>
    </div>
  );
}

function H() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="h3">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[28px] left-[231.28px] not-italic text-[#101828] text-[18px] text-center top-[-1px] whitespace-nowrap">Birth Certificate</p>
    </div>
  );
}

function P3() {
  return (
    <div className="content-stretch flex h-[20px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[20px] min-h-px min-w-px not-italic relative text-[#4a5565] text-[14px] text-center">Birth Certificate - Carlos Rodriguez.pdf</p>
    </div>
  );
}

function Container13() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[8px] h-[56px] items-start left-0 top-[80px] w-[463.5px]" data-name="Container">
      <H />
      <P3 />
    </div>
  );
}

function P4() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#99a1af] text-[12px] text-center">📄 PDF Document Preview</p>
    </div>
  );
}

function P5() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#99a1af] text-[12px] text-center">In production, actual PDF content would display here</p>
    </div>
  );
}

function P6() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#99a1af] text-[12px] text-center">using react-pdf library</p>
    </div>
  );
}

function Container14() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[4px] h-[56px] items-start left-0 top-[152px] w-[463.5px]" data-name="Container">
      <P4 />
      <P5 />
      <P6 />
    </div>
  );
}

function P7() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#6a7282] text-[12px]">Document Information:</p>
    </div>
  );
}

function P8() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[0] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[0px] text-[12px]">
        <span className="leading-[16px]">Type:</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px]">{` Birth Certificate`}</span>
      </p>
    </div>
  );
}

function P9() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[0] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[0px] text-[12px]">
        <span className="leading-[16px]">File Name:</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px]">{` Birth Certificate - Carlos Rodriguez.pdf`}</span>
      </p>
    </div>
  );
}

function P10() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[0] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[0px] text-[12px]">
        <span className="leading-[16px]">Upload Date:</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px]">{` 2026-02-20`}</span>
      </p>
    </div>
  );
}

function P11() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[0] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[0px] text-[12px]">
        <span className="leading-[16px]">Status:</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px]">{` `}</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px] text-[#00a63e]">Verified</span>
      </p>
    </div>
  );
}

function Container16() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] h-[76px] items-start relative shrink-0 w-full" data-name="Container">
      <P8 />
      <P9 />
      <P10 />
      <P11 />
    </div>
  );
}

function Container15() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[8px] h-[117px] items-start left-0 pt-[17px] top-[240px] w-[463.5px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-solid border-t inset-0 pointer-events-none" />
      <P7 />
      <Container16 />
    </div>
  );
}

function Container12() {
  return (
    <div className="h-[357px] relative shrink-0 w-full" data-name="Container">
      <FileText2 />
      <Container13 />
      <Container14 />
      <Container15 />
    </div>
  );
}

function Container11() {
  return (
    <div className="bg-white h-[685.234px] relative shrink-0 w-[529.5px]" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[#d1d5dc] border-solid inset-0 pointer-events-none shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-px pt-[33px] px-[33px] relative size-full">
        <Container12 />
      </div>
    </div>
  );
}

function Container10() {
  return (
    <div className="h-[600px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center justify-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-center justify-center pr-[15px] relative size-full">
          <Container11 />
        </div>
      </div>
    </div>
  );
}

function Container6() {
  return (
    <div className="bg-[#f3f4f6] content-stretch flex flex-col h-[649px] items-start relative shrink-0 w-full" data-name="Container">
      <Container7 />
      <Container10 />
    </div>
  );
}

function Container() {
  return (
    <div className="bg-white h-[754px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start p-px relative size-full">
          <Container1 />
          <Container6 />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function FileText3() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="FileText">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="FileText">
          <path d={svgPaths.p3713e00} id="Vector" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.pd2076c0} id="Vector_2" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M8.33333 7.5H6.66667" id="Vector_3" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M13.3333 10.8333H6.66667" id="Vector_4" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M13.3333 14.1667H6.66667" id="Vector_5" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Container20() {
  return (
    <div className="bg-[#fef2f2] relative rounded-[10px] shrink-0 size-[40px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <FileText3 />
      </div>
    </div>
  );
}

function P12() {
  return (
    <div className="absolute content-stretch flex h-[20px] items-start left-0 overflow-clip top-0 w-[291.297px]" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Medium',sans-serif] font-medium leading-[20px] min-h-px min-w-px not-italic relative text-[#101828] text-[14px]">Form 138 - Carlos Rodriguez.pdf</p>
    </div>
  );
}

function P13() {
  return (
    <div className="absolute content-stretch flex h-[16px] items-start left-0 top-[24px] w-[291.297px]" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#6a7282] text-[12px]">Uploaded: 2026-02-20</p>
    </div>
  );
}

function Badge1() {
  return (
    <div className="absolute h-[22px] left-0 rounded-[8px] top-[48px] w-[144.625px]" data-name="Badge">
      <div className="content-stretch flex items-center justify-center overflow-clip px-[9px] py-[3px] relative rounded-[inherit] size-full">
        <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[#1a1a1a] text-[12px] whitespace-nowrap">Form 138 (Report Card)</p>
      </div>
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8px]" />
    </div>
  );
}

function Container21() {
  return (
    <div className="flex-[1_0_0] h-[70px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <P12 />
        <P13 />
        <Badge1 />
      </div>
    </div>
  );
}

function Container19() {
  return (
    <div className="flex-[1_0_0] h-[70px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-start relative size-full">
        <Container20 />
        <Container21 />
      </div>
    </div>
  );
}

function ExternalLink1() {
  return (
    <div className="absolute left-[11px] size-[16px] top-[8px]" data-name="ExternalLink">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ExternalLink">
          <path d="M10 2H14V6" id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M6.66667 9.33333L14 2" id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p25f66900} id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button6() {
  return (
    <div className="bg-white h-[32px] relative rounded-[8px] shrink-0 w-[77.688px]" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <ExternalLink1 />
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[52.5px] not-italic text-[#1a1a1a] text-[12px] text-center top-[8px] whitespace-nowrap">Open</p>
      </div>
    </div>
  );
}

function Download1() {
  return (
    <div className="absolute left-[11px] size-[16px] top-[8px]" data-name="Download">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Download">
          <path d={svgPaths.p23ad1400} id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p19411800} id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M8 10V2" id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button7() {
  return (
    <div className="bg-white flex-[1_0_0] h-[32px] min-h-px min-w-px relative rounded-[8px]" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Download1 />
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[65px] not-italic text-[#1a1a1a] text-[12px] text-center top-[8px] whitespace-nowrap">Download</p>
      </div>
    </div>
  );
}

function Container22() {
  return (
    <div className="h-[32px] relative shrink-0 w-[189.203px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-start relative size-full">
        <Button6 />
        <Button7 />
      </div>
    </div>
  );
}

function Container18() {
  return (
    <div className="bg-[#f9fafb] h-[103px] relative shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
      <div className="content-stretch flex items-start justify-between pb-px pt-[16px] px-[16px] relative size-full">
        <Container19 />
        <Container22 />
      </div>
    </div>
  );
}

function ZoomOut1() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ZoomOut">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ZoomOut">
          <path d={svgPaths.p107a080} id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M14 14L11.1 11.1" id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M5.33333 7.33333H9.33333" id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button8() {
  return (
    <div className="h-[32px] relative rounded-[8px] shrink-0 w-[36px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <ZoomOut1 />
      </div>
    </div>
  );
}

function Span2() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="flex-[1_0_0] font-['Inter:Medium',sans-serif] font-medium leading-[20px] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[14px] text-center">100%</p>
      </div>
    </div>
  );
}

function ZoomIn1() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ZoomIn">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ZoomIn">
          <path d={svgPaths.p107a080} id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M14 14L11.1 11.1" id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M7.33333 5.33333V9.33333" id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M5.33333 7.33333H9.33333" id="Vector_4" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button9() {
  return (
    <div className="h-[32px] relative rounded-[8px] shrink-0 w-[36px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <ZoomIn1 />
      </div>
    </div>
  );
}

function Container25() {
  return (
    <div className="h-[32px] relative shrink-0 w-[148px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Button8 />
        <Span2 />
        <Button9 />
      </div>
    </div>
  );
}

function ChevronLeft1() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ChevronLeft">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ChevronLeft">
          <path d="M10 12L6 8L10 4" id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button10() {
  return (
    <div className="h-[32px] opacity-50 relative rounded-[8px] shrink-0 w-[36px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <ChevronLeft1 />
      </div>
    </div>
  );
}

function Span3() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[#1a1a1a] text-[14px] whitespace-nowrap">Page 1 of 1</p>
      </div>
    </div>
  );
}

function ChevronRight1() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ChevronRight">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ChevronRight">
          <path d="M6 12L10 8L6 4" id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button11() {
  return (
    <div className="h-[32px] opacity-50 relative rounded-[8px] shrink-0 w-[36px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <ChevronRight1 />
      </div>
    </div>
  );
}

function Container26() {
  return (
    <div className="h-[32px] relative shrink-0 w-[157.25px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Button10 />
        <Span3 />
        <Button11 />
      </div>
    </div>
  );
}

function Container24() {
  return (
    <div className="bg-white h-[49px] relative shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between pb-px px-[16px] relative size-full">
          <Container25 />
          <Container26 />
        </div>
      </div>
    </div>
  );
}

function FileText4() {
  return (
    <div className="absolute left-[199.75px] size-[64px] top-0" data-name="FileText">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 64 64">
        <g id="FileText">
          <path d={svgPaths.p3f6fb600} id="Vector" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
          <path d={svgPaths.p29192380} id="Vector_2" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
          <path d="M26.6667 24H21.3333" id="Vector_3" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
          <path d="M42.6667 34.6667H21.3333" id="Vector_4" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
          <path d="M42.6667 45.3333H21.3333" id="Vector_5" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
        </g>
      </svg>
    </div>
  );
}

function H1() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="h3">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[28px] left-[232.06px] not-italic text-[#101828] text-[18px] text-center top-[-1px] whitespace-nowrap">Form 138 (Report Card)</p>
    </div>
  );
}

function P14() {
  return (
    <div className="content-stretch flex h-[20px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[20px] min-h-px min-w-px not-italic relative text-[#4a5565] text-[14px] text-center">Form 138 - Carlos Rodriguez.pdf</p>
    </div>
  );
}

function Container30() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[8px] h-[56px] items-start left-0 top-[80px] w-[463.5px]" data-name="Container">
      <H1 />
      <P14 />
    </div>
  );
}

function P15() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#99a1af] text-[12px] text-center">📄 PDF Document Preview</p>
    </div>
  );
}

function P16() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#99a1af] text-[12px] text-center">In production, actual PDF content would display here</p>
    </div>
  );
}

function P17() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#99a1af] text-[12px] text-center">using react-pdf library</p>
    </div>
  );
}

function Container31() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[4px] h-[56px] items-start left-0 top-[152px] w-[463.5px]" data-name="Container">
      <P15 />
      <P16 />
      <P17 />
    </div>
  );
}

function P18() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#6a7282] text-[12px]">Document Information:</p>
    </div>
  );
}

function P19() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[0] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[0px] text-[12px]">
        <span className="leading-[16px]">Type:</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px]">{` Form 138 (Report Card)`}</span>
      </p>
    </div>
  );
}

function P20() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[0] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[0px] text-[12px]">
        <span className="leading-[16px]">File Name:</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px]">{` Form 138 - Carlos Rodriguez.pdf`}</span>
      </p>
    </div>
  );
}

function P21() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[0] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[0px] text-[12px]">
        <span className="leading-[16px]">Upload Date:</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px]">{` 2026-02-20`}</span>
      </p>
    </div>
  );
}

function P22() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[0] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[0px] text-[12px]">
        <span className="leading-[16px]">Status:</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px]">{` `}</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px] text-[#00a63e]">Verified</span>
      </p>
    </div>
  );
}

function Container33() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] h-[76px] items-start relative shrink-0 w-full" data-name="Container">
      <P19 />
      <P20 />
      <P21 />
      <P22 />
    </div>
  );
}

function Container32() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[8px] h-[117px] items-start left-0 pt-[17px] top-[240px] w-[463.5px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-solid border-t inset-0 pointer-events-none" />
      <P18 />
      <Container33 />
    </div>
  );
}

function Container29() {
  return (
    <div className="h-[357px] relative shrink-0 w-full" data-name="Container">
      <FileText4 />
      <Container30 />
      <Container31 />
      <Container32 />
    </div>
  );
}

function Container28() {
  return (
    <div className="bg-white h-[685.234px] relative shrink-0 w-[529.5px]" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[#d1d5dc] border-solid inset-0 pointer-events-none shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-px pt-[33px] px-[33px] relative size-full">
        <Container29 />
      </div>
    </div>
  );
}

function Container27() {
  return (
    <div className="h-[600px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center justify-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-center justify-center pr-[15px] relative size-full">
          <Container28 />
        </div>
      </div>
    </div>
  );
}

function Container23() {
  return (
    <div className="bg-[#f3f4f6] content-stretch flex flex-col h-[649px] items-start relative shrink-0 w-full" data-name="Container">
      <Container24 />
      <Container27 />
    </div>
  );
}

function Container17() {
  return (
    <div className="bg-white h-[754px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start p-px relative size-full">
          <Container18 />
          <Container23 />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function FileText5() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="FileText">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="FileText">
          <path d={svgPaths.p3713e00} id="Vector" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.pd2076c0} id="Vector_2" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M8.33333 7.5H6.66667" id="Vector_3" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M13.3333 10.8333H6.66667" id="Vector_4" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M13.3333 14.1667H6.66667" id="Vector_5" stroke="var(--stroke-0, #8B1538)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Container37() {
  return (
    <div className="bg-[#fef2f2] relative rounded-[10px] shrink-0 size-[40px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <FileText5 />
      </div>
    </div>
  );
}

function P23() {
  return (
    <div className="absolute content-stretch flex h-[20px] items-start left-0 overflow-clip top-0 w-[291.297px]" data-name="p">
      <p className="font-['Inter:Medium',sans-serif] font-medium leading-[20px] not-italic relative shrink-0 text-[#101828] text-[14px] whitespace-nowrap">Good Moral Certificate - Carlos Rodriguez.pdf</p>
    </div>
  );
}

function P24() {
  return (
    <div className="absolute content-stretch flex h-[16px] items-start left-0 top-[24px] w-[291.297px]" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#6a7282] text-[12px]">Uploaded: 2026-02-20</p>
    </div>
  );
}

function Badge2() {
  return (
    <div className="absolute h-[22px] left-0 rounded-[8px] top-[48px] w-[142.531px]" data-name="Badge">
      <div className="content-stretch flex items-center justify-center overflow-clip px-[9px] py-[3px] relative rounded-[inherit] size-full">
        <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[#1a1a1a] text-[12px] whitespace-nowrap">Good Moral Certificate</p>
      </div>
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8px]" />
    </div>
  );
}

function Container38() {
  return (
    <div className="flex-[1_0_0] h-[70px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <P23 />
        <P24 />
        <Badge2 />
      </div>
    </div>
  );
}

function Container36() {
  return (
    <div className="flex-[1_0_0] h-[70px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-start relative size-full">
        <Container37 />
        <Container38 />
      </div>
    </div>
  );
}

function ExternalLink2() {
  return (
    <div className="absolute left-[11px] size-[16px] top-[8px]" data-name="ExternalLink">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ExternalLink">
          <path d="M10 2H14V6" id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M6.66667 9.33333L14 2" id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p25f66900} id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button12() {
  return (
    <div className="bg-white h-[32px] relative rounded-[8px] shrink-0 w-[77.688px]" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <ExternalLink2 />
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[52.5px] not-italic text-[#1a1a1a] text-[12px] text-center top-[8px] whitespace-nowrap">Open</p>
      </div>
    </div>
  );
}

function Download2() {
  return (
    <div className="absolute left-[11px] size-[16px] top-[8px]" data-name="Download">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Download">
          <path d={svgPaths.p23ad1400} id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p19411800} id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M8 10V2" id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button13() {
  return (
    <div className="bg-white flex-[1_0_0] h-[32px] min-h-px min-w-px relative rounded-[8px]" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Download2 />
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[65px] not-italic text-[#1a1a1a] text-[12px] text-center top-[8px] whitespace-nowrap">Download</p>
      </div>
    </div>
  );
}

function Container39() {
  return (
    <div className="h-[32px] relative shrink-0 w-[189.203px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-start relative size-full">
        <Button12 />
        <Button13 />
      </div>
    </div>
  );
}

function Container35() {
  return (
    <div className="bg-[#f9fafb] h-[103px] relative shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
      <div className="content-stretch flex items-start justify-between pb-px pt-[16px] px-[16px] relative size-full">
        <Container36 />
        <Container39 />
      </div>
    </div>
  );
}

function ZoomOut2() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ZoomOut">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ZoomOut">
          <path d={svgPaths.p107a080} id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M14 14L11.1 11.1" id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M5.33333 7.33333H9.33333" id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button14() {
  return (
    <div className="h-[32px] relative rounded-[8px] shrink-0 w-[36px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <ZoomOut2 />
      </div>
    </div>
  );
}

function Span4() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="flex-[1_0_0] font-['Inter:Medium',sans-serif] font-medium leading-[20px] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[14px] text-center">100%</p>
      </div>
    </div>
  );
}

function ZoomIn2() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ZoomIn">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ZoomIn">
          <path d={svgPaths.p107a080} id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M14 14L11.1 11.1" id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M7.33333 5.33333V9.33333" id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M5.33333 7.33333H9.33333" id="Vector_4" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button15() {
  return (
    <div className="h-[32px] relative rounded-[8px] shrink-0 w-[36px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <ZoomIn2 />
      </div>
    </div>
  );
}

function Container42() {
  return (
    <div className="h-[32px] relative shrink-0 w-[148px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Button14 />
        <Span4 />
        <Button15 />
      </div>
    </div>
  );
}

function ChevronLeft2() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ChevronLeft">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ChevronLeft">
          <path d="M10 12L6 8L10 4" id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button16() {
  return (
    <div className="h-[32px] opacity-50 relative rounded-[8px] shrink-0 w-[36px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <ChevronLeft2 />
      </div>
    </div>
  );
}

function Span5() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[#1a1a1a] text-[14px] whitespace-nowrap">Page 1 of 1</p>
      </div>
    </div>
  );
}

function ChevronRight2() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ChevronRight">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ChevronRight">
          <path d="M6 12L10 8L6 4" id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button17() {
  return (
    <div className="h-[32px] opacity-50 relative rounded-[8px] shrink-0 w-[36px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <ChevronRight2 />
      </div>
    </div>
  );
}

function Container43() {
  return (
    <div className="h-[32px] relative shrink-0 w-[157.25px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Button16 />
        <Span5 />
        <Button17 />
      </div>
    </div>
  );
}

function Container41() {
  return (
    <div className="bg-white h-[49px] relative shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between pb-px px-[16px] relative size-full">
          <Container42 />
          <Container43 />
        </div>
      </div>
    </div>
  );
}

function FileText6() {
  return (
    <div className="absolute left-[199.75px] size-[64px] top-0" data-name="FileText">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 64 64">
        <g id="FileText">
          <path d={svgPaths.p3f6fb600} id="Vector" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
          <path d={svgPaths.p29192380} id="Vector_2" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
          <path d="M26.6667 24H21.3333" id="Vector_3" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
          <path d="M42.6667 34.6667H21.3333" id="Vector_4" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
          <path d="M42.6667 45.3333H21.3333" id="Vector_5" stroke="var(--stroke-0, #D1D5DC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5.33333" />
        </g>
      </svg>
    </div>
  );
}

function H2() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="h3">
      <p className="-translate-x-1/2 absolute font-['Inter:Bold',sans-serif] font-bold leading-[28px] left-[232.31px] not-italic text-[#101828] text-[18px] text-center top-[-1px] whitespace-nowrap">Good Moral Certificate</p>
    </div>
  );
}

function P25() {
  return (
    <div className="content-stretch flex h-[20px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[20px] min-h-px min-w-px not-italic relative text-[#4a5565] text-[14px] text-center">Good Moral Certificate - Carlos Rodriguez.pdf</p>
    </div>
  );
}

function Container47() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[8px] h-[56px] items-start left-0 top-[80px] w-[463.5px]" data-name="Container">
      <H2 />
      <P25 />
    </div>
  );
}

function P26() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#99a1af] text-[12px] text-center">📄 PDF Document Preview</p>
    </div>
  );
}

function P27() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#99a1af] text-[12px] text-center">In production, actual PDF content would display here</p>
    </div>
  );
}

function P28() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#99a1af] text-[12px] text-center">using react-pdf library</p>
    </div>
  );
}

function Container48() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[4px] h-[56px] items-start left-0 top-[152px] w-[463.5px]" data-name="Container">
      <P26 />
      <P27 />
      <P28 />
    </div>
  );
}

function P29() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#6a7282] text-[12px]">Document Information:</p>
    </div>
  );
}

function P30() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[0] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[0px] text-[12px]">
        <span className="leading-[16px]">Type:</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px]">{` Good Moral Certificate`}</span>
      </p>
    </div>
  );
}

function P31() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[0] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[0px] text-[12px]">
        <span className="leading-[16px]">File Name:</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px]">{` Good Moral Certificate - Carlos Rodriguez.pdf`}</span>
      </p>
    </div>
  );
}

function P32() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[0] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[0px] text-[12px]">
        <span className="leading-[16px]">Upload Date:</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px]">{` 2026-02-20`}</span>
      </p>
    </div>
  );
}

function P33() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[0] min-h-px min-w-px not-italic relative text-[#1a1a1a] text-[0px] text-[12px]">
        <span className="leading-[16px]">Status:</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px]">{` `}</span>
        <span className="font-['Inter:Regular',sans-serif] font-normal leading-[16px] text-[#00a63e]">Verified</span>
      </p>
    </div>
  );
}

function Container50() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] h-[76px] items-start relative shrink-0 w-full" data-name="Container">
      <P30 />
      <P31 />
      <P32 />
      <P33 />
    </div>
  );
}

function Container49() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[8px] h-[117px] items-start left-0 pt-[17px] top-[240px] w-[463.5px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-solid border-t inset-0 pointer-events-none" />
      <P29 />
      <Container50 />
    </div>
  );
}

function Container46() {
  return (
    <div className="h-[357px] relative shrink-0 w-full" data-name="Container">
      <FileText6 />
      <Container47 />
      <Container48 />
      <Container49 />
    </div>
  );
}

function Container45() {
  return (
    <div className="bg-white h-[685.234px] relative shrink-0 w-[529.5px]" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[#d1d5dc] border-solid inset-0 pointer-events-none shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-px pt-[33px] px-[33px] relative size-full">
        <Container46 />
      </div>
    </div>
  );
}

function Container44() {
  return (
    <div className="h-[600px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center justify-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-center justify-center pr-[15px] relative size-full">
          <Container45 />
        </div>
      </div>
    </div>
  );
}

function Container40() {
  return (
    <div className="bg-[#f3f4f6] content-stretch flex flex-col h-[649px] items-start relative shrink-0 w-full" data-name="Container">
      <Container41 />
      <Container44 />
    </div>
  );
}

function Container34() {
  return (
    <div className="bg-white h-[754px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start p-px relative size-full">
          <Container35 />
          <Container40 />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function Div1() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] h-[2294px] items-start overflow-clip relative shrink-0 w-full" data-name="div">
      <Container />
      <Container17 />
      <Container34 />
    </div>
  );
}

function TabsContent() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[578.5px]" data-name="TabsContent">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[16px] items-start relative size-full">
        <Div />
        <Div1 />
      </div>
    </div>
  );
}

function Tabs() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[8px] h-[2400px] items-start left-[24px] top-[102px] w-[578.5px]" data-name="Tabs">
      <TabsList />
      <TabsContent />
    </div>
  );
}

function XCircle() {
  return (
    <div className="absolute left-[13px] size-[16px] top-[10px]" data-name="XCircle">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g clipPath="url(#clip0_417_1250)" id="XCircle">
          <path d={svgPaths.p39ee6532} id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M10 6L6 10" id="Vector_2" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M6 6L10 10" id="Vector_3" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
        <defs>
          <clipPath id="clip0_417_1250">
            <rect fill="white" height="16" width="16" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button18() {
  return (
    <div className="bg-white h-[36px] relative rounded-[8px] shrink-0 w-[96.531px]" data-name="Button">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <XCircle />
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-[64px] not-italic text-[#1a1a1a] text-[14px] text-center top-[7px] whitespace-nowrap">Reject</p>
      </div>
    </div>
  );
}

function SelectValue() {
  return (
    <div className="h-[20px] relative shrink-0 w-[88.547px]" data-name="SelectValue">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center overflow-clip relative rounded-[inherit] size-full">
        <p className="font-['Inter:Medium',sans-serif] font-medium leading-[20px] not-italic relative shrink-0 text-[#6b7280] text-[14px] text-center whitespace-nowrap">Select Section</p>
      </div>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="ChevronDownIcon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="ChevronDownIcon" opacity="0.5">
          <path d="M4 6L8 10L12 6" id="Vector" stroke="var(--stroke-0, #6B7280)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function SelectTrigger() {
  return (
    <div className="bg-[#f9fafb] h-[36px] relative rounded-[8px] shrink-0 w-[318.766px]" data-name="SelectTrigger">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0)] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-between px-[13px] py-px relative size-full">
        <SelectValue />
        <ChevronDownIcon />
      </div>
    </div>
  );
}

function CheckCircle() {
  return (
    <div className="absolute left-[12px] size-[16px] top-[10px]" data-name="CheckCircle">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g clipPath="url(#clip0_417_1243)" id="CheckCircle">
          <path d={svgPaths.p34e03900} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p1f2c5400} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
        <defs>
          <clipPath id="clip0_417_1243">
            <rect fill="white" height="16" width="16" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button19() {
  return (
    <div className="bg-[#2d5016] h-[36px] opacity-50 relative rounded-[8px] shrink-0 w-[147.203px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <CheckCircle />
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-[90.5px] not-italic text-[14px] text-center text-white top-[7px] whitespace-nowrap">Final Approval</p>
      </div>
    </div>
  );
}

function DialogFooter() {
  return (
    <div className="absolute content-stretch flex gap-[8px] h-[36px] items-start justify-end left-[24px] top-[2534px] w-[578.5px]" data-name="DialogFooter">
      <Button18 />
      <SelectTrigger />
      <Button19 />
    </div>
  );
}

function XIcon() {
  return (
    <div className="h-[16px] overflow-clip relative shrink-0 w-full" data-name="XIcon">
      <div className="absolute inset-1/4" data-name="Vector">
        <div className="absolute inset-[-8.33%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 9.33333 9.33333">
            <path d={svgPaths.p48af40} id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-1/4" data-name="Vector">
        <div className="absolute inset-[-8.33%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 9.33333 9.33333">
            <path d={svgPaths.p30908200} id="Vector" stroke="var(--stroke-0, #1A1A1A)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function DialogPrimitiveClose() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-[587px] opacity-70 rounded-[2px] size-[16px] top-[8px]" data-name="DialogPrimitive.Close">
      <XIcon />
    </div>
  );
}

export default function DialogContent() {
  return (
    <div className="bg-white border border-[rgba(0,0,0,0.1)] border-solid overflow-clip relative rounded-[10px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] size-full" data-name="DialogContent">
      <DialogHeader />
      <Tabs />
      <DialogFooter />
      <DialogPrimitiveClose />
    </div>
  );
}