import svgPaths from "./svg-bcba3hdr6n";

function Icon() {
  return (
    <div className="absolute left-[15.99px] size-[31.989px] top-[16px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 31.9886 31.9886">
        <g id="Icon">
          <path d="M15.9943 9.33002V27.9901" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66572" />
          <path d={svgPaths.pc986400} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66572" />
        </g>
      </svg>
    </div>
  );
}

function Container3() {
  return (
    <div className="absolute bg-[#8b1538] left-[31.99px] rounded-[10px] size-[63.991px] top-[31.99px]" data-name="Container">
      <Icon />
    </div>
  );
}

function Heading() {
  return (
    <div className="absolute h-[32.003px] left-[31.99px] top-[111.97px] w-[526.222px]" data-name="Heading 3">
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[32px] left-0 not-italic text-[#101828] text-[24px] top-0">Humanities and Social Sciences (HUMSS)</p>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="absolute h-[71.974px] left-[31.99px] top-[155.97px] w-[526.222px]" data-name="Paragraph">
      <p className="absolute block font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#4a5565] text-[16px] top-0 w-[521px] whitespace-pre-wrap">
        Designed for students interested in pursuing careers in social sciences, education, humanities, liberal arts, and communication arts.
      </p>
    </div>
  );
}

function Container2() {
  return (
    <div className="absolute h-[339.915px] left-0 top-0 w-[590.199px]" data-name="Container">
      <Container3 />
      <Heading />
      <Paragraph />
    </div>
  );
}

function Container1() {
  return (
    <div className="absolute bg-white border-[0.909px] border-[rgba(0,0,0,0.1)] border-solid h-[272px] left-[0.01px] rounded-[14px] shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] top-[0.03px] w-[544px]" data-name="Container">
      <Container2 />
    </div>
  );
}

function Icon1() {
  return (
    <div className="absolute left-[15.99px] size-[31.989px] top-[16px]" data-name="Icon">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 31.9886 31.9886">
        <g id="Icon">
          <path d={svgPaths.p27718b80} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66572" />
          <path d="M29.3229 13.3286V21.3258" id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66572" />
          <path d={svgPaths.p291942c0} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66572" />
        </g>
      </svg>
    </div>
  );
}

function Container6() {
  return (
    <div className="absolute bg-[#2d5016] left-[31.99px] rounded-[10px] size-[63.991px] top-[31.99px]" data-name="Container">
      <Icon1 />
    </div>
  );
}

function Heading1() {
  return (
    <div className="absolute h-[32.003px] left-[31.99px] top-[111.97px] w-[526.222px]" data-name="Heading 3">
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[32px] left-0 not-italic text-[#101828] text-[24px] top-0">Technical-Vocational-Livelihood (TVL)</p>
    </div>
  );
}

function Paragraph1() {
  return (
    <div className="absolute h-[71.974px] left-[31.99px] top-[155.97px] w-[526.222px]" data-name="Paragraph">
      <ul className="absolute block font-['Inter:Regular',sans-serif] font-normal leading-[0] left-0 list-disc not-italic text-[#4a5565] text-[16px] top-[-2.09px] w-[523px] whitespace-pre-wrap">
        <li className="mb-0 ms-[24px]">
          <span className="leading-[24px]">Information and Communications Technology (ICT)</span>
        </li>
        <li className="mb-0 ms-[24px]">
          <span className="leading-[24px]">Electrical Installation and Maintenance (EIM)</span>
        </li>
        <li className="ms-[24px]">
          <span className="leading-[24px]">Bread and Pastry Production/ Food and Beverages Services</span>
        </li>
      </ul>
    </div>
  );
}

function Container5() {
  return (
    <div className="absolute h-[339.915px] left-0 top-0 w-[590.199px]" data-name="Container">
      <Container6 />
      <Heading1 />
      <Paragraph1 />
    </div>
  );
}

function Container4() {
  return (
    <div className="absolute bg-white border-[0.909px] border-[rgba(0,0,0,0.1)] border-solid h-[272px] left-[582.01px] rounded-[14px] shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] top-[0.03px] w-[556px]" data-name="Container">
      <Container5 />
    </div>
  );
}

export default function Container() {
  return (
    <div className="relative size-full" data-name="Container">
      <Container1 />
      <Container4 />
    </div>
  );
}