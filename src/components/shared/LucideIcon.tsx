import { lazy, Suspense } from 'react';
import { LucideProps } from 'lucide-react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';

interface LucideIconProps extends Omit<LucideProps, 'ref'> {
  name: string;
}

const fallback = <div className="h-4 w-4" />;

const LucideIcon = ({ name, ...props }: LucideIconProps) => {
  const kebabName = name.toLowerCase().replace(/\s+/g, '-') as keyof typeof dynamicIconImports;
  
  if (!dynamicIconImports[kebabName]) {
    // Fallback to circle-dot if icon name is invalid
    const FallbackIcon = lazy(dynamicIconImports['circle-dot']);
    return (
      <Suspense fallback={fallback}>
        <FallbackIcon {...props} />
      </Suspense>
    );
  }

  const Icon = lazy(dynamicIconImports[kebabName]);

  return (
    <Suspense fallback={fallback}>
      <Icon {...props} />
    </Suspense>
  );
};

export default LucideIcon;
