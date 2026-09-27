import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { NativeRectExportOutput, NativeRectExportPlan } from './ReactLYCompositor.types';

declare class ReactLYCompositorModule extends NativeModule<{}> {
  exportAsync(plan: NativeRectExportPlan): Promise<NativeRectExportOutput>;
}

export default requireOptionalNativeModule<ReactLYCompositorModule>('ReactLYCompositor');
