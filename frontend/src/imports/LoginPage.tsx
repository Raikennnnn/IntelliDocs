import imgImageNuestraSenoraDeGuiaAcademy from "figma:asset/e11655a0bb448323cab4def085b422d71c615f64.png";
import img6425705401609027733346922618764889990646353N2 from "figma:asset/ec0f266d7e7cff918808f5daaab9064f36194772.png";

function Container({ className }: { className?: string }) {
  return (
    <div className={className || "bg-[#8b1538] h-[63px] relative rounded-[10px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] w-[1280px]"} data-name="Container">
      <div className="absolute h-[77.983px] left-[29px] top-0 w-[638.523px]" data-name="Container">
        <div className="absolute h-[40px] left-0 top-[14px] w-[253.58px]" data-name="Link">
          <div className="absolute left-0 size-[40px] top-0" data-name="Image (Nuestra Señora De Guia Academy)">
            <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgImageNuestraSenoraDeGuiaAcademy} />
          </div>
          <div className="absolute h-[38.48px] left-[51.99px] top-[0.76px] w-[201.591px]" data-name="Container">
            <div className="absolute h-[22.486px] left-0 top-0 w-[201.591px]" data-name="Paragraph">
              <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[22.5px] left-0 not-italic text-[18px] text-white top-[-0.91px]">Nuestra Señora De Guia</p>
            </div>
            <div className="absolute h-[15.994px] left-0 top-[22.49px] w-[201.591px]" data-name="Paragraph">
              <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[16px] left-0 not-italic text-[12px] text-white top-0">Academy of Marikina</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage({ className }: { className?: string }) {
  return (
    <div className={className || "bg-white h-[810px] relative w-[1280px]"} data-name="Login Page">
      <div className="absolute h-[943px] left-0 top-0 w-[1280px]" data-name="642570540_1609027733346922_618764889990646353_n 2">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img alt="" className="absolute h-[99.08%] left-[-0.05%] max-w-none top-[-12.37%] w-full" src={img6425705401609027733346922618764889990646353N2} />
        </div>
      </div>
      <div className="absolute bg-[rgba(72,0,21,0.32)] h-[810px] left-0 top-0 w-[1280px]" data-name="Container">
        <div className="absolute bg-[rgba(255,255,255,0.69)] border border-black border-solid h-[416px] left-[403px] rounded-[10px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] top-[197px] w-[527px]" data-name="Container">
          <div className="absolute h-[371.946px] left-[30.99px] top-[30.99px] w-[638.523px]" data-name="Container">
            <div className="absolute h-[63.991px] left-0 top-0 w-[638.523px]" data-name="Container">
              <div className="absolute h-[32.003px] left-0 top-0 w-[638.523px]" data-name="Heading 2">
                <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[32px] left-0 not-italic text-[#101828] text-[24px] top-0">Login</p>
              </div>
              <div className="absolute h-[23.991px] left-0 top-[40px] w-[638.523px]" data-name="Paragraph">
                <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[16px] text-black top-[-2.09px]">Enter your credentials to access the system</p>
              </div>
            </div>
            <div className="absolute h-[235.98px] left-0 top-[87.98px] w-[638.523px]" data-name="Form">
              <div className="absolute h-[70px] left-0 top-0 w-[638.523px]" data-name="Container">
                <div className="absolute h-[14.006px] left-0 top-0 w-[638.523px]" data-name="Primitive.label">
                  <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[14px] left-0 not-italic text-[14px] text-black top-0">Username</p>
                </div>
                <div className="absolute bg-[#f9fafb] border-[#d1d5dc] border-[0.909px] border-solid h-[48px] left-[0.01px] overflow-clip rounded-[8px] top-[22.03px] w-[468px]" data-name="Text Input">
                  <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[normal] left-[11.09px] not-italic text-[#6b7280] text-[14px] top-[14.59px]">Enter username</p>
                </div>
              </div>
              <div className="absolute h-[70px] left-0 top-[93.99px] w-[638.523px]" data-name="Container">
                <div className="absolute h-[14.006px] left-0 top-0 w-[638.523px]" data-name="Primitive.label">
                  <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[14px] left-0 not-italic text-[14px] text-black top-0">Password</p>
                </div>
                <div className="absolute bg-[#f9fafb] border-[#d1d5dc] border-[0.909px] border-solid h-[48px] left-[0.01px] overflow-clip rounded-[8px] top-[22.04px] w-[467px]" data-name="Password Input">
                  <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[normal] left-[11.09px] not-italic text-[#6b7280] text-[14px] top-[14.59px]">Enter password</p>
                </div>
              </div>
              <div className="absolute bg-[#8b1538] h-[48px] left-[0.01px] rounded-[8px] top-[188.03px] w-[468px]" data-name="Button">
                <p className="-translate-x-1/2 absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-[229.5px] not-italic text-[16px] text-center text-white top-[12px]">Login</p>
              </div>
              <div className="absolute bg-[#8b1538] h-[48px] left-[0.01px] rounded-[8px] top-[188.03px] w-[468px]" data-name="Button">
                <p className="-translate-x-1/2 absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-[229.5px] not-italic text-[16px] text-center text-white top-[12px]">Login</p>
              </div>
            </div>
            <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[normal] left-[373.01px] not-italic text-[10px] text-black top-[328.01px]">Forgot Password?</p>
          </div>
        </div>
        <Container className="absolute bg-[#8b1538] h-[63px] left-[-1px] rounded-[10px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)] top-0 w-[1280px]" />
        <div className="absolute h-[77.983px] left-[295px] top-[78px] w-[268.793px]" data-name="Container" />
        <div className="absolute h-[20px] left-[564px] top-[146px] w-[268.793px]" data-name="Paragraph" />
      </div>
      <div className="absolute h-0 left-0 top-[810px] w-[1280px]" data-name="Section" />
    </div>
  );
}