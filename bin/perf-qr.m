#import <AppKit/AppKit.h>
#import <CoreImage/CoreImage.h>

int main(int argc, const char *argv[]) {
  if (argc != 3) return 2;
  @autoreleasepool {
    NSString *url = [NSString stringWithUTF8String:argv[1]];
    NSString *path = [NSString stringWithUTF8String:argv[2]];
    CIFilter *filter = [CIFilter filterWithName:@"CIQRCodeGenerator"];
    if (!filter) { fprintf(stderr, "QR filter unavailable\n"); return 1; }
    [filter setValue:[url dataUsingEncoding:NSUTF8StringEncoding] forKey:@"inputMessage"];
    [filter setValue:@"M" forKey:@"inputCorrectionLevel"];
    CIImage *image = [[filter outputImage] imageByApplyingTransform:CGAffineTransformMakeScale(12, 12)];
    if (!image) { fprintf(stderr, "QR image unavailable\n"); return 1; }
    CIContext *context = [CIContext contextWithOptions:@{ kCIContextUseSoftwareRenderer: @YES }];
    CGImageRef cgImage = [context createCGImage:image fromRect:[image extent]];
    if (!cgImage) { fprintf(stderr, "QR render failed\n"); return 1; }
    NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithCGImage:cgImage];
    NSData *png = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
    BOOL written = [png writeToFile:path atomically:YES];
    CGImageRelease(cgImage);
    if (!written) fprintf(stderr, "QR write failed: %s\n", argv[2]);
    return written ? 0 : 1;
  }
}
