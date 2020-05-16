import React from "react";
import { UnitContext, CombinedContext, ThemeContext, LanguageContext } from "./Contexts";

// This is a reusable piece that could be used by any component that requires both contexts.
const ProvideCombinedContext = props => {
    return (
        <ThemeContext.Consumer>
            {themecontext =>
                <UnitContext.Consumer>
                    {unitcontext =>
                        <LanguageContext.Consumer>
                            {languagecontext =>
                                <CombinedContext.Provider value={{ ...themecontext, ...unitcontext, ...languagecontext }}>
                                    {props.children}
                                </CombinedContext.Provider>
                            }
                        </LanguageContext.Consumer>
                    }
                </UnitContext.Consumer>
            }
        </ThemeContext.Consumer>
    );
};
export default ProvideCombinedContext;